const DEFAULT_MAX_OPERATIONS = 64;
const DEFAULT_MAX_CONCURRENCY = 16;
const DEFAULT_CONCURRENCY = 8;

const SEMANTIC_STEPS = new Set(["inspect", "change_verify", "finalize"]);

function asSet(value) {
  return value instanceof Set ? value : new Set(value || []);
}

function assertId(id, index) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(id)) {
    throw new Error(`BATCH_ID_INVALID:${index}`);
  }
}

function getRef(ref, completed) {
  const raw = String(ref || "").trim();
  if (!raw) throw new Error("BATCH_REF_REQUIRED");
  const parts = raw.split(".");
  const id = parts.shift();
  if (!completed.has(id)) throw new Error(`BATCH_REF_UNKNOWN:${id}`);

  let value = completed.get(id);
  for (const part of parts) {
    if (
      value === null ||
      value === undefined ||
      (typeof value !== "object" && !Array.isArray(value)) ||
      !(part in value)
    ) {
      throw new Error(`BATCH_REF_PATH_INVALID:${raw}`);
    }
    value = value[part];
  }
  return value;
}

function collectRefIds(value, out = new Set(), depth = 0) {
  if (depth > 16) throw new Error("BATCH_REF_MAX_DEPTH");

  if (Array.isArray(value)) {
    for (const item of value) collectRefIds(item, out, depth + 1);
    return out;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$ref") {
      const raw = String(value.$ref || "").trim();
      const id = raw.split(".")[0];
      if (id) out.add(id);
      return out;
    }

    for (const child of Object.values(value)) {
      collectRefIds(child, out, depth + 1);
    }
  }

  return out;
}

function resolveRefs(value, completed, depth = 0) {
  if (depth > 16) throw new Error("BATCH_REF_MAX_DEPTH");

  if (Array.isArray(value)) {
    return value.map((item) => resolveRefs(item, completed, depth + 1));
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$ref") {
      return getRef(value.$ref, completed);
    }

    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = resolveRefs(child, completed, depth + 1);
    }
    return out;
  }

  return value;
}

function clipText(value, maxBytes) {
  const text = String(value ?? "");
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  return (
    buf.subarray(0, maxBytes).toString("utf8") +
    `\n...<COMPACT_TRUNCATED ${buf.length - maxBytes} BYTES>`
  );
}

function compactResult(entry, maxTextBytes) {
  const base = {
    id: entry.id,
    kind: entry.kind,
    ok: entry.ok,
    elapsedMs: entry.elapsedMs,
  };

  if (!entry.ok) {
    return {
      ...base,
      error:
        entry.error || entry.result?.error || "BATCH_OPERATION_FAILED",
      skipped: Boolean(entry.skipped),
    };
  }

  const result = entry.result;
  if (result === null || result === undefined) return base;
  if (typeof result !== "object") {
    return { ...base, result: clipText(result, maxTextBytes) };
  }

  const selected = {};
  const scalarKeys = [
    "ok",
    "path",
    "exists",
    "type",
    "bytes",
    "bytesRead",
    "bytesWritten",
    "sha256",
    "mode",
    "encoding",
    "repo",
    "head",
    "newHead",
    "exitCode",
    "timedOut",
    "pid",
    "state",
    "revision",
    "clean",
  ];

  for (const key of scalarKeys) {
    if (result[key] !== undefined) selected[key] = result[key];
  }

  for (const key of ["stdout", "stderr", "content", "data", "summary"]) {
    if (result[key] !== undefined) {
      selected[key] = clipText(result[key], maxTextBytes);
    }
  }

  if (Array.isArray(result.matches)) {
    selected.matches = result.matches.slice(0, 20).map((match) => {
      if (!match || typeof match !== "object") return match;
      return {
        ...match,
        ...(match.text !== undefined
          ? { text: clipText(match.text, Math.min(maxTextBytes, 768)) }
          : {}),
      };
    });
  }

  return { ...base, result: selected };
}

function outputEntry(entry, operation, globalMode, maxTextBytes) {
  const capture = String(operation?.capture || globalMode || "compact").toLowerCase();
  if (capture === "full") return entry;
  if (capture === "none") {
    return {
      id: entry.id,
      kind: entry.kind,
      ok: entry.ok,
      elapsedMs: entry.elapsedMs,
      ...(entry.ok
        ? {}
        : { error: entry.error || entry.result?.error || "BATCH_OPERATION_FAILED" }),
    };
  }
  return compactResult(entry, maxTextBytes);
}

function semanticRolePolicy(semanticStep) {
  if (semanticStep === "inspect") {
    return {
      allowedRoles: new Set(["inspect"]),
      roleRank: { inspect: 0 },
      mutationRole: null,
    };
  }

  if (semanticStep === "change_verify") {
    return {
      allowedRoles: new Set(["inspect", "change", "verify"]),
      roleRank: { inspect: 0, change: 1, verify: 2 },
      mutationRole: "change",
    };
  }

  return {
    allowedRoles: new Set(["inspect", "finalize", "verify"]),
    roleRank: { inspect: 0, finalize: 1, verify: 2 },
    mutationRole: "finalize",
  };
}

export function createSemanticBatchEngine(options = {}) {
  if (typeof options.dispatch !== "function") {
    throw new Error("BATCH_DISPATCH_REQUIRED");
  }

  const dispatch = options.dispatch;
  const telemetry =
    typeof options.telemetry === "function" ? options.telemetry : () => {};
  const readOnlyKinds = asSet(options.readOnlyKinds);
  const verifyDeniedKinds = asSet(options.verifyDeniedKinds);
  const autoParallelKinds = asSet(options.autoParallelKinds);
  const explicitParallelKinds = asSet(options.explicitParallelKinds);
  const maxOperations = Math.max(
    1,
    Math.min(Number(options.maxOperations || DEFAULT_MAX_OPERATIONS), 1024),
  );
  const maxConcurrency = Math.max(
    1,
    Math.min(Number(options.maxConcurrency || DEFAULT_MAX_CONCURRENCY), 128),
  );
  const defaultConcurrency = Math.max(
    1,
    Math.min(Number(options.defaultConcurrency || DEFAULT_CONCURRENCY), maxConcurrency),
  );

  function parallelEligible(operation, strategy) {
    if (strategy !== "dag") return false;
    const kind = String(operation?.kind || "").trim();
    if (autoParallelKinds.has(kind)) return true;
    return operation?.parallel === true && explicitParallelKinds.has(kind);
  }

  function prepareSemanticStep(input = {}) {
    const semanticStep = String(input.semanticStep || "")
      .trim()
      .toLowerCase();
    if (!SEMANTIC_STEPS.has(semanticStep)) {
      throw new Error("SEMANTIC_STEP_INVALID");
    }

    const sourceOperations = Array.isArray(input.operations) ? input.operations : [];
    if (!sourceOperations.length || sourceOperations.length > maxOperations) {
      throw new Error("SEMANTIC_OPERATIONS_INVALID");
    }

    const operations = sourceOperations.map((operation, index) => ({
      ...operation,
      id: String(operation?.id || `op${index + 1}`).trim(),
    }));

    const policy = semanticRolePolicy(semanticStep);
    let previousRank = -1;

    for (const operation of operations) {
      const role = String(
        operation.role || (semanticStep === "inspect" ? "inspect" : ""),
      )
        .trim()
        .toLowerCase();

      if (!policy.allowedRoles.has(role)) {
        throw new Error(`SEMANTIC_ROLE_INVALID:${operation.id}`);
      }

      operation.role = role;
      const kind = String(operation.kind || "").trim();

      if (role === "inspect" && !readOnlyKinds.has(kind)) {
        throw new Error(`SEMANTIC_INSPECT_KIND_DENIED:${operation.id}`);
      }

      if (role === "verify" && verifyDeniedKinds.has(kind)) {
        throw new Error(`SEMANTIC_VERIFY_KIND_DENIED:${operation.id}`);
      }

      const rank = policy.roleRank[role];
      if (rank < previousRank) {
        throw new Error(`SEMANTIC_ROLE_ORDER_INVALID:${operation.id}`);
      }
      previousRank = Math.max(previousRank, rank);
    }

    if (policy.mutationRole) {
      const mutationIds = operations
        .filter((operation) => operation.role === policy.mutationRole)
        .map((operation) => operation.id);
      const verificationOperations = operations.filter(
        (operation) => operation.role === "verify",
      );

      if (!mutationIds.length) throw new Error("SEMANTIC_MUTATION_ROLE_REQUIRED");
      if (!verificationOperations.length) throw new Error("SEMANTIC_VERIFY_REQUIRED");

      for (const operation of verificationOperations) {
        const deps = new Set(
          Array.isArray(operation.dependsOn)
            ? operation.dependsOn.map(String)
            : [],
        );
        for (const id of mutationIds) deps.add(id);
        operation.dependsOn = [...deps];
      }
    }

    return {
      semanticStep,
      operations,
      tag: input.tag == null ? null : String(input.tag).slice(0, 80),
      concurrency: input.concurrency,
    };
  }

  async function runBatch(input = {}) {
    const operations = Array.isArray(input.operations) ? input.operations : [];
    if (!operations.length || operations.length > maxOperations) {
      throw new Error("BATCH_OPERATIONS_INVALID");
    }

    const stopOnError = input.stopOnError !== false;
    const strategy = String(input.strategy || "serial").toLowerCase();
    if (!new Set(["serial", "dag"]).has(strategy)) {
      throw new Error("BATCH_STRATEGY_INVALID");
    }

    const concurrency = Math.max(
      1,
      Math.min(Number(input.concurrency || defaultConcurrency), maxConcurrency),
    );
    const resultMode = String(input.resultMode || "compact").toLowerCase();
    if (!new Set(["compact", "full", "none"]).has(resultMode)) {
      throw new Error("BATCH_RESULT_MODE_INVALID");
    }

    const compactMaxTextBytes = Math.max(
      256,
      Math.min(Number(input.compactMaxTextBytes || 2048), 65536),
    );

    const idToIndex = new Map();
    const meta = operations.map((operation, index) => {
      const id = String(operation?.id || `op${index + 1}`).trim();
      assertId(id, index);
      if (idToIndex.has(id)) throw new Error(`BATCH_ID_DUPLICATE:${id}`);
      idToIndex.set(id, index);
      return {
        id,
        index,
        operation,
        kind: String(operation?.kind || "").trim(),
        deps: new Set(),
        parallelEligible: parallelEligible(operation, strategy),
      };
    });

    let lastBarrier = null;
    for (const item of meta) {
      if (!item.kind) throw new Error(`BATCH_KIND_REQUIRED:${item.id}`);

      const explicitDeps = Array.isArray(item.operation.dependsOn)
        ? item.operation.dependsOn.map(String)
        : [];
      const refDeps = [...collectRefIds(item.operation.args || {})];

      for (const dep of [...explicitDeps, ...refDeps]) {
        if (!idToIndex.has(dep)) {
          throw new Error(`BATCH_DEPENDENCY_UNKNOWN:${dep}`);
        }
        if (idToIndex.get(dep) >= item.index) {
          throw new Error(`BATCH_DEPENDENCY_MUST_PRECEDE:${dep}->${item.id}`);
        }
        item.deps.add(dep);
      }

      if (strategy === "serial") {
        if (item.index > 0) item.deps.add(meta[item.index - 1].id);
        item.parallelEligible = false;
        continue;
      }

      if (!item.parallelEligible) {
        for (let index = 0; index < item.index; index += 1) {
          item.deps.add(meta[index].id);
        }
        lastBarrier = item.id;
      } else if (lastBarrier) {
        item.deps.add(lastBarrier);
      }
    }

    const startedAtMs = Date.now();
    const completed = new Map();
    const pending = new Map(meta.map((item) => [item.id, item]));
    let failed = 0;
    let peakParallelism = 1;
    let parallelGroups = 0;
    let aborted = false;

    async function runOne(item) {
      const operationStartedAt = Date.now();
      const failedDeps = [...item.deps].filter(
        (dep) => completed.get(dep)?.ok === false,
      );

      if (failedDeps.length) {
        return {
          id: item.id,
          kind: item.kind,
          ok: false,
          skipped: true,
          elapsedMs: 0,
          error: `BATCH_DEPENDENCY_FAILED:${failedDeps.join(",")}`,
        };
      }

      try {
        const args = resolveRefs(
          item.operation.args &&
            typeof item.operation.args === "object" &&
            !Array.isArray(item.operation.args)
            ? item.operation.args
            : {},
          completed,
        );
        const result = await dispatch(item.kind, args, item.operation);
        return {
          id: item.id,
          kind: item.kind,
          ok: result?.ok !== false,
          elapsedMs: Date.now() - operationStartedAt,
          result,
        };
      } catch (error) {
        return {
          id: item.id,
          kind: item.kind,
          ok: false,
          elapsedMs: Date.now() - operationStartedAt,
          error: String(error?.message || error),
        };
      }
    }

    while (pending.size && !aborted) {
      const ready = [...pending.values()]
        .filter((item) => [...item.deps].every((dep) => completed.has(dep)))
        .sort((a, b) => a.index - b.index);

      if (!ready.length) throw new Error("BATCH_DEPENDENCY_CYCLE");

      const first = ready[0];
      const group = first.parallelEligible
        ? ready.filter((item) => item.parallelEligible).slice(0, concurrency)
        : [first];

      if (group.length > 1) parallelGroups += 1;
      peakParallelism = Math.max(peakParallelism, group.length);

      const entries = await Promise.all(group.map(runOne));
      for (let index = 0; index < group.length; index += 1) {
        pending.delete(group[index].id);
        completed.set(group[index].id, entries[index]);
        if (!entries[index].ok) failed += 1;
      }

      if (stopOnError && entries.some((entry) => !entry.ok)) aborted = true;
    }

    const executedMeta = meta.filter((item) => completed.has(item.id));
    const results = executedMeta.map((item) =>
      outputEntry(
        completed.get(item.id),
        item.operation,
        resultMode,
        compactMaxTextBytes,
      ),
    );

    return {
      ok: failed === 0,
      mode: "DIRECT",
      strategy,
      concurrency,
      resultMode,
      operationsRequested: operations.length,
      operationsExecuted: executedMeta.length,
      failed,
      stoppedEarly: executedMeta.length < operations.length,
      stopOnError,
      wallMs: Date.now() - startedAtMs,
      parallelism: { peak: peakParallelism, groups: parallelGroups },
      outerCallCompression: {
        semanticOuterCalls: 1,
        nestedLocalOperations: executedMeta.length,
      },
      results,
    };
  }

  async function runSemanticStep(input = {}, context = {}) {
    const prepared = prepareSemanticStep(input);
    const roleById = new Map(
      prepared.operations.map((operation) => [operation.id, operation.role]),
    );
    const captureById = new Map(
      prepared.operations.map((operation) => [
        operation.id,
        String(operation.capture || "").toLowerCase(),
      ]),
    );

    const batch = await runBatch({
      operations: prepared.operations,
      strategy: "dag",
      concurrency: prepared.concurrency,
      resultMode: "compact",
      stopOnError: true,
    });

    const evidence = batch.results.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      role: roleById.get(entry.id) || null,
      ok: entry.ok,
      elapsedMs: entry.elapsedMs,
      skipped: Boolean(entry.skipped),
    }));

    const selectedResults =
      batch.ok && prepared.semanticStep !== "inspect"
        ? batch.results.filter((entry) =>
            new Set(["compact", "full"]).has(captureById.get(entry.id)),
          )
        : batch.results;

    const telemetryEvent = {
      event: "semantic_batch",
      semanticStep: prepared.semanticStep,
      tag: prepared.tag,
      ok: batch.ok,
      operationsRequested: batch.operationsRequested,
      operationsExecuted: batch.operationsExecuted,
      failed: batch.failed,
      stoppedEarly: batch.stoppedEarly,
      wallMs: batch.wallMs,
      peakParallelism: batch.parallelism.peak,
      parallelGroups: batch.parallelism.groups,
      context: context.telemetryContext || undefined,
    };

    await telemetry(telemetryEvent);

    return {
      ok: batch.ok,
      mode: "DIRECT",
      semanticStep: prepared.semanticStep,
      tag: prepared.tag,
      qualityContract: {
        semanticBoundaryPreserved: true,
        failFast: true,
        verifyRequiredAfterMutation: prepared.semanticStep !== "inspect",
        securityBoundaryBypassed: false,
      },
      operationsRequested: batch.operationsRequested,
      operationsExecuted: batch.operationsExecuted,
      failed: batch.failed,
      stoppedEarly: batch.stoppedEarly,
      wallMs: batch.wallMs,
      parallelism: batch.parallelism,
      outerCallCompression: batch.outerCallCompression,
      evidence,
      results: selectedResults,
    };
  }

  return {
    prepareSemanticStep,
    runBatch,
    runSemanticStep,
  };
}
