# Semantic Batching — Compress Mechanical Choreography

Status: **PROVEN**

This pattern converts many low-level operations into one bounded semantic execution request while preserving dependency ordering, fail-fast behavior, and mandatory post-mutation verification.

## Problem

A naive agent loop often looks like:

```text
read A -> model -> read B -> model -> git status -> model -> edit A -> model
-> edit B -> model -> test -> model -> fix -> model -> retest -> model -> git diff
```

Most transitions above do not require a new semantic decision. They are mechanical choreography.

## Target

```text
Model semantic decision
  -> semantic batch
       - reads/searches (parallel where independent)
       - change
       - test/verify
       - deterministic repair/retest if implemented
  -> compact evidence
  -> model only if needed
```

## Generic operation shape

```json
{
  "id": "readConfig",
  "kind": "fs.read",
  "role": "inspect",
  "args": { "path": "config.json" },
  "dependsOn": [],
  "parallel": true,
  "capture": "compact"
}
```

Required concepts:

- `id`: unique within the batch;
- `kind`: dispatcher capability key;
- `role`: semantic role;
- `args`: capability-specific input;
- `dependsOn`: explicit dependencies;
- `parallel`: opt-in where the capability class permits it;
- `capture`: `none`, `compact`, or `full`.

## Result references

A later operation may use a value returned by an earlier operation:

```json
{
  "id": "writeConfig",
  "kind": "fs.write",
  "role": "change",
  "args": {
    "path": "config.json",
    "expectedSha256": { "$ref": "readConfig.result.sha256" },
    "content": "..."
  }
}
```

A `$ref` creates an implicit dependency. Forward references are denied. Unknown reference paths fail the batch rather than becoming `undefined` silently.

## DAG rules

For each operation, dependencies are the union of:

- explicit `dependsOn` ids;
- ids discovered from `$ref` arguments;
- semantic barriers added by the batch planner.

The executor repeatedly selects operations whose dependencies are complete.

If no pending operation can become ready, treat it as a dependency-cycle/configuration error.

## Parallelism rules

Use a capability allowlist/classification rather than parallelizing arbitrary operations.

Good automatic candidates:

- stat/list/read/search;
- read-only runtime/process inspection;
- Git status/diff;
- independent metadata lookups.

Possible explicit candidates:

- independent test commands;
- independent external reads;
- commands operating in isolated targets.

Default barriers:

- filesystem mutation;
- Git mutation;
- process mutation;
- publish/send/release;
- operations with unknown side effects.

A generated implementation may support more concurrency if it has stronger transaction/workspace ownership guarantees. The default should be conservative.

## Semantic role enforcement

### `inspect`

Allowed roles: `inspect` only.

All operation kinds must be known read-only kinds. This prevents an agent from hiding mutation in a step labeled inspection.

### `change_verify`

Allowed role order:

```text
inspect* -> change+ -> verify+
```

Requirements:

- at least one `change` operation;
- at least one `verify` operation;
- every verify operation depends on every change operation.

### `finalize`

Allowed role order:

```text
inspect* -> finalize+ -> verify+
```

Use for bounded finalization such as commit/package/final state transition where post-finalization verification is still required.

## Why role ordering matters

Semantic labels are useful only if the runtime enforces them. Without enforcement an agent can accidentally:

- mutate during "inspection";
- claim verification before all mutations complete;
- run a verification step and then mutate again in the same semantic epoch;
- finalize and then continue arbitrary edits.

Role ordering turns the semantic contract into an executable invariant.

## Fail-fast behavior

Default: `stopOnError = true`.

When an operation fails:

- dependent operations are skipped/failed with dependency evidence;
- unrelated already-running parallel reads may finish;
- the batch returns compact failure evidence;
- do not continue mutation after a failed prerequisite unless an explicit repair policy owns that continuation.

A more advanced runtime may include deterministic repair inside the job, but repair must still obey scope/fence/verification rules.

## Output compaction

Each operation should always expose at least:

```json
{
  "id": "test",
  "kind": "exec.run",
  "ok": true,
  "elapsedMs": 420
}
```

Compact output may also include decision-relevant fields such as:

- file hash/size;
- exit code/timed-out flag;
- truncated stdout/stderr;
- Git HEAD/status summary;
- process id/state;
- search match summaries.

Large text should be byte-bounded and explicitly marked truncated.

For successful mutation batches, it is often useful to return full/compact payload only for operations explicitly marked for capture while still returning evidence metadata for every operation.

## Security interaction

Batching must not create a bypass around per-capability security checks.

The dispatcher invoked by the batch must be the **same bounded dispatcher** used by individual operations, or an equivalent shared policy boundary. Do not implement one safe public tool path and a second unchecked batch path.

## Outer-call compression metric

A useful receipt field is:

```json
{
  "outerCallCompression": {
    "semanticOuterCalls": 1,
    "nestedLocalOperations": 9
  }
}
```

This does not prove quality by itself, but makes orchestration amplification visible.

## Reproduction acceptance

A portable implementation should prove:

1. independent reads can execute concurrently;
2. a mutation step without verification is rejected;
3. verify automatically waits for all mutations;
4. `$ref` dependencies resolve correctly and reject forward/unknown references;
5. a prerequisite failure prevents dependent mutation;
6. result output is bounded/truncation-aware;
7. security/policy checks are not bypassed through batch dispatch;
8. the receipt reports nested operations vs outer semantic calls.
