# State Acquisition — Read Once, Decide Once

Status: **PROVEN**

The fastest orchestration path is often not a faster executor; it is avoiding unnecessary state reconstruction.

## Principle

Acquire the smallest **decision-complete** state snapshot possible, then reuse it until a real invalidation signal appears.

Do not confuse "fresh" with "re-read everything after every operation."

## Proven startup shape

A production ILYNTO Native MCP path currently advertises the equivalent of:

```text
system.status
  -> project.resume (when project context is needed)
  -> one semantic batch per semantic step
```

The transferable idea is not the literal tool names. It is the shape:

1. one cheap system/capability health summary;
2. one aggregate project/task resume call if project state matters;
3. targeted execution.

An aggregate resume should collect independent state concurrently where practical, for example:

```text
project descriptor
+ runtime health
+ project Git HEAD/status
+ memory/state revision
+ active workspace ownership
+ current checkpoint
```

The model should not need six outer calls to reconstruct those six facts.

## Freshness rules

Use a new read when at least one is true:

- the value is required for a write fence and was not observed for the current semantic epoch;
- an external actor may have changed the resource;
- a previous operation explicitly invalidated the value;
- evidence is stale relative to a known version/revision transition;
- health signals conflict;
- a failure indicates stale state;
- a new semantic decision genuinely depends on current external state.

Do **not** re-read merely because:

- another local deterministic step completed;
- the same job performed a write it already tracks;
- a previous read succeeded milliseconds ago and there is no competing writer signal;
- the model is accustomed to issuing status commands between every action.

## State-first, process-list fallback

Prefer an explicit health/state endpoint over process enumeration.

Process listing is useful when:

- the health endpoint is unavailable;
- the reported state is contradictory;
- a process leak/duplicate instance is the actual problem;
- PID/command-line evidence is required for recovery.

It should not be a mandatory first call in every task.

## Source fences

For mutation, bind to the strongest practical current source marker:

- Git repository: full commit HEAD, optionally root tree/status digest;
- file: SHA-256 or equivalent content hash;
- HTTP/API resource: ETag/version/revision;
- database record: revision/version/timestamp with transaction semantics;
- generated runtime: manifest/version plus critical-file hashes.

If the fence is stale, prefer **REPLAN / refresh** rather than writing over unknown state.

## Aggregate-read design

A good aggregate read is:

- read-only;
- bounded in output size;
- parallel internally where reads are independent;
- explicit about missing/unobserved fields;
- stable enough for an agent to consume without parsing raw logs;
- free of plaintext secrets;
- compact enough that it does not become a new context bottleneck.

## Decision-complete response example

```json
{
  "ok": true,
  "observedAt": "...",
  "target": {
    "id": "project-x",
    "root": "<resolved-root>"
  },
  "runtime": {
    "healthy": true,
    "transportReady": true
  },
  "git": {
    "head": "<40-hex>",
    "clean": true
  },
  "state": {
    "revision": 12,
    "checkpoint": "ready-for-change"
  },
  "ownership": {
    "conflict": false
  }
}
```

This is decision material. It is not a transcript of every diagnostic probe used to produce it.

## Failure behavior

If aggregate state cannot be produced:

1. return which component is unobserved/failed;
2. run targeted diagnostics only for that component;
3. do not silently substitute stale memory as fresh state;
4. do not expand authority while diagnosing;
5. resume the same semantic goal after state is repaired or refreshed.

## Reproduction checklist

A generated runtime implementing this pattern should demonstrate:

- one aggregate state call replaces multiple independent outer reads;
- internal independent reads run concurrently where safe;
- stale fences are detected before mutation;
- repeated unchanged status reads are not required on the healthy path;
- missing state is represented explicitly rather than guessed;
- no secret values are included in the aggregate response.
