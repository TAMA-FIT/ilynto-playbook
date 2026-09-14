import test from "node:test";
import assert from "node:assert/strict";

import { createSemanticBatchEngine } from "../references/orchestration/semantic-batch.mjs";
import {
  chooseExecutionRoute,
  routeFailureReceipt,
} from "../references/orchestration/router.mjs";

const READ_ONLY = new Set(["read", "stat", "search", "verify"]);
const VERIFY_DENIED = new Set(["write", "delete", "commit"]);
const AUTO_PARALLEL = new Set(["read", "stat", "search"]);
const EXPLICIT_PARALLEL = new Set(["exec"]);

function makeEngine(overrides = {}) {
  const telemetryEvents = [];
  const calls = [];

  const dispatch =
    overrides.dispatch ||
    (async (kind, args) => {
      calls.push({ kind, args });
      if (kind === "read") {
        return {
          ok: true,
          content: args.content ?? "value",
          sha256: args.sha256 ?? "abc",
        };
      }
      if (kind === "write") return { ok: true, sha256: "def" };
      if (kind === "verify") return { ok: true, state: "verified" };
      if (kind === "fail") return { ok: false, error: "expected failure" };
      return { ok: true, ...args };
    });

  const engine = createSemanticBatchEngine({
    dispatch,
    telemetry: async (event) => telemetryEvents.push(event),
    readOnlyKinds: READ_ONLY,
    verifyDeniedKinds: VERIFY_DENIED,
    autoParallelKinds: AUTO_PARALLEL,
    explicitParallelKinds: EXPLICIT_PARALLEL,
    maxConcurrency: 8,
  });

  return { engine, telemetryEvents, calls };
}

test("inspect semantic step rejects mutating capability", () => {
  const { engine } = makeEngine();
  assert.throws(
    () =>
      engine.prepareSemanticStep({
        semanticStep: "inspect",
        operations: [{ id: "oops", kind: "write", role: "inspect", args: {} }],
      }),
    /SEMANTIC_INSPECT_KIND_DENIED:oops/,
  );
});

test("change_verify requires verification", () => {
  const { engine } = makeEngine();
  assert.throws(
    () =>
      engine.prepareSemanticStep({
        semanticStep: "change_verify",
        operations: [{ id: "change", kind: "write", role: "change", args: {} }],
      }),
    /SEMANTIC_VERIFY_REQUIRED/,
  );
});

test("verification automatically depends on every mutation", () => {
  const { engine } = makeEngine();
  const prepared = engine.prepareSemanticStep({
    semanticStep: "change_verify",
    operations: [
      { id: "changeA", kind: "write", role: "change", args: {} },
      { id: "changeB", kind: "write", role: "change", args: {} },
      { id: "check", kind: "verify", role: "verify", args: {} },
    ],
  });

  const verify = prepared.operations.find((operation) => operation.id === "check");
  assert.deepEqual(new Set(verify.dependsOn), new Set(["changeA", "changeB"]));
});

test("result references create data dependency and resolve values", async () => {
  const seen = [];
  const { engine } = makeEngine({
    dispatch: async (kind, args) => {
      seen.push({ kind, args });
      if (kind === "read") return { ok: true, sha256: "source-hash" };
      if (kind === "write") {
        assert.equal(args.expectedSha256, "source-hash");
        return { ok: true };
      }
      return { ok: true };
    },
  });

  const result = await engine.runBatch({
    strategy: "dag",
    operations: [
      { id: "source", kind: "read", args: {} },
      {
        id: "change",
        kind: "write",
        args: { expectedSha256: { $ref: "source.result.sha256" } },
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(seen.length, 2);
});

test("forward result references are rejected before execution", async () => {
  const { engine } = makeEngine();
  await assert.rejects(
    () =>
      engine.runBatch({
        strategy: "dag",
        operations: [
          { id: "first", kind: "read", args: { x: { $ref: "second.result.x" } } },
          { id: "second", kind: "read", args: {} },
        ],
      }),
    /BATCH_DEPENDENCY_MUST_PRECEDE:second->first/,
  );
});

test("independent read operations can execute in parallel", async () => {
  let active = 0;
  let peak = 0;

  const { engine } = makeEngine({
    dispatch: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 40));
      active -= 1;
      return { ok: true };
    },
  });

  const result = await engine.runBatch({
    strategy: "dag",
    concurrency: 4,
    operations: [
      { id: "a", kind: "read", args: {} },
      { id: "b", kind: "read", args: {} },
      { id: "c", kind: "stat", args: {} },
    ],
  });

  assert.equal(result.ok, true);
  assert.ok(peak >= 2);
  assert.ok(result.parallelism.peak >= 2);
  assert.equal(result.outerCallCompression.semanticOuterCalls, 1);
  assert.equal(result.outerCallCompression.nestedLocalOperations, 3);
});

test("non-parallel mutation acts as a barrier", async () => {
  const order = [];
  const { engine } = makeEngine({
    dispatch: async (kind, args) => {
      order.push(`start:${args.name}`);
      await new Promise((resolve) => setTimeout(resolve, args.delay || 1));
      order.push(`end:${args.name}`);
      return { ok: true };
    },
  });

  const result = await engine.runBatch({
    strategy: "dag",
    operations: [
      { id: "a", kind: "read", args: { name: "a", delay: 20 } },
      { id: "b", kind: "read", args: { name: "b", delay: 20 } },
      { id: "w", kind: "write", args: { name: "w" } },
      { id: "c", kind: "read", args: { name: "c" } },
    ],
  });

  assert.equal(result.ok, true);
  assert.ok(order.indexOf("start:w") > order.indexOf("end:a"));
  assert.ok(order.indexOf("start:w") > order.indexOf("end:b"));
  assert.ok(order.indexOf("start:c") > order.indexOf("end:w"));
});

test("fail-fast stops later operations after a failure", async () => {
  const { engine } = makeEngine();
  const result = await engine.runBatch({
    strategy: "serial",
    stopOnError: true,
    operations: [
      { id: "a", kind: "read", args: {} },
      { id: "b", kind: "fail", args: {} },
      { id: "c", kind: "write", args: {} },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.operationsExecuted, 2);
  assert.equal(result.stoppedEarly, true);
});

test("successful mutation semantic step returns verification evidence and telemetry", async () => {
  const { engine, telemetryEvents } = makeEngine();
  const result = await engine.runSemanticStep({
    semanticStep: "change_verify",
    tag: "test-change",
    operations: [
      { id: "change", kind: "write", role: "change", args: {}, capture: "compact" },
      { id: "verify", kind: "verify", role: "verify", args: {}, capture: "compact" },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.qualityContract.verifyRequiredAfterMutation, true);
  assert.deepEqual(
    result.evidence.map((entry) => entry.role),
    ["change", "verify"],
  );
  assert.equal(telemetryEvents.length, 1);
  assert.equal(telemetryEvents[0].event, "semantic_batch");
});

test("router keeps routine eligible work DIRECT", () => {
  assert.deepEqual(
    chooseExecutionRoute({
      policyAllowed: true,
      fenceMatches: true,
      writerConflict: false,
      riskTier: "low",
      directEligible: true,
      mutationRequested: true,
    }),
    {
      route: "DIRECT",
      state: "ALLOW",
      reason: "DIRECT_FAST_PATH",
      mutationAllowed: true,
      automaticFallback: false,
    },
  );
});

test("router stops stale source before mutation", () => {
  const result = chooseExecutionRoute({
    policyAllowed: true,
    fenceMatches: false,
    mutationRequested: true,
  });
  assert.equal(result.route, "GUARD");
  assert.equal(result.state, "REPLAN");
  assert.equal(result.mutationAllowed, false);
});

test("router produces Human Boundary for explicit high-impact reason", () => {
  const result = chooseExecutionRoute({
    humanBoundaryReasons: ["external_publish_send"],
    mutationRequested: true,
  });
  assert.equal(result.state, "HUMAN_BOUNDARY");
  assert.equal(result.reason, "external_publish_send");
  assert.equal(result.automaticFallback, false);
});

test("managed route is explicit and never automatic fallback", () => {
  const result = chooseExecutionRoute({
    managedSemanticsNeeded: true,
    managedReason: "RELEASE_GOVERNANCE",
    mutationRequested: true,
  });
  assert.equal(result.route, "MANAGED");
  assert.equal(result.automaticFallback, false);
});

test("route failure receipt requires explicit replan", () => {
  const receipt = routeFailureReceipt({
    route: "DIRECT",
    reason: "LOCAL_RUNTIME_UNAVAILABLE",
    suggestedRoutes: ["MANAGED"],
  });
  assert.equal(receipt.ok, false);
  assert.equal(receipt.state, "REPLAN");
  assert.equal(receipt.automaticFallback, false);
  assert.deepEqual(receipt.suggestedRoutes, ["MANAGED"]);
});
