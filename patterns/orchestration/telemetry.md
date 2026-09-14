# Telemetry — Measure Orchestration Amplification

Status: **PROVEN**

Optimization must be measured at the same boundary the user experiences: **instruction to verified outcome**.

## Minimum metrics

Track enough to answer:

- how many model-visible/outer calls were required?
- how many local operations were nested inside those calls?
- how long did the semantic batch/job take?
- how much time was actual test/build execution vs orchestration overhead?
- how often did work return for replan/retry/Human Boundary?
- did batching/parallelism reduce wall time without changing outcome quality?

Recommended fields:

```yaml
semantic_batches: 1
outer_calls: 1
nested_local_operations: 9
operations_per_outer_call: 9.0
wall_ms: 842
failed_batches: 0
retry_count: 0
replan_count: 0
human_boundary_count: 0
peak_parallelism: 4
returned_bytes: 8200
```

## Outer-call instrumentation

Instrument at the public/tool boundary rather than requiring callers to report their own call counts.

For each public call record compact metadata such as:

- timestamp;
- tool/capability name;
- success/failure;
- elapsed time;
- whether it was a semantic fast-path call;
- whether it was a primitive that could potentially have been compressed.

Do not store full arguments by default.

## Semantic-batch instrumentation

For each semantic batch record:

- semantic step (`inspect`, `change_verify`, `finalize`);
- operations requested/executed;
- failures/stopped-early flag;
- wall time;
- role histogram;
- capability-kind histogram;
- peak parallelism / parallel groups.

This enables questions such as:

- Are agents still using primitive outer calls instead of batches?
- Which workloads benefit from batching?
- Is a route adding latency without increasing quality?
- Did a safety change add hot-path overhead?

## Privacy defaults

Telemetry should be useful without becoming another sensitive transcript store.

Recommended defaults:

- no full prompts;
- no full tool arguments;
- no plaintext secrets;
- hash/pseudonymize project/session identifiers when correlation is needed;
- keep only bounded compact result metadata;
- local-first log storage;
- bounded rotation by size/count;
- upload/remote analytics only when explicitly desired.

## Rotation

A simple local JSONL log is sufficient for many systems.

Example policy:

```yaml
format: jsonl
max_file_bytes: 2097152
rotated_generations: 3
rotation_check: on_append_only
```

Do not add file-stat/rotation work to every healthy request when no telemetry event is being written.

## Benchmark discipline

Compare routes using equivalent:

- model family/config where relevant;
- initial source revision;
- user intent;
- target environment;
- verification scope.

Measure both:

### Quality

- requirement success;
- final diff/state;
- tests/lint/typecheck;
- unnecessary changes;
- regression result;
- security/Human Boundary correctness;
- evidence integrity;
- false-completion rate.

### Performance

- user-instruction-to-verified-outcome wall time;
- outer calls;
- transport round trips;
- model semantic returns;
- returned bytes;
- local operations;
- retries/replans;
- test/build time.

Do not adopt a faster path solely because its local command duration is lower.

## Workload-aware routing

Performance is workload dependent. A specialized read burst can outperform a generic semantic job for pure reads, while a semantic job can outperform serial primitives for edit/test/verify workflows.

Therefore retain a faster specialized path when measurement proves it adds value. Architecture simplification should remove redundant choreography, not useful optimized primitives.

## Regression budget

When modifying security or orchestration:

- benchmark the normal hot path before and after;
- use enough warmed samples to reduce startup noise;
- compare median/p95 when useful;
- treat small differences within noise honestly;
- do not claim speedup from one lucky sample;
- pair performance evidence with outcome-quality parity.
