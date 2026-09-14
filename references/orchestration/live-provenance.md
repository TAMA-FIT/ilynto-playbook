# Live Provenance — Fast Verified Orchestration Extraction

Status: **PROVEN extraction**

Observed: **2026-09-15**

This document records where the public orchestration pattern came from and what was deliberately excluded. It is intended to prevent the public playbook from drifting into unsupported theory.

## Observed live basis

The source environment was an active local ILYNTO deployment using:

- Native MCP server version: `0.16.9-fastpath-r8`
- Native routing model reported by the live server: `zero-extra-call-v1`
- Native mode: `ROUTED_BASE`
- Guard role: exceptional-boundary precheck only
- Managed role: specialized/legacy verified job engine, not the default route
- Automatic alternate-control-plane fallback: disabled
- Local Core lineage: `0.38.69-jsonb-digest-r1`

Exact source snapshot hashes observed during extraction:

- Native MCP `server.mjs` SHA-256: `d752d27ae14a33914fea00b73c38f21886e3c3b79daaa305b8c7c945de6922ce`
- Local Core `server.mjs` SHA-256: `fc3984bdac85372bb7a0b0b35c15e1c36d7546b14b3256115f293b0e57338851`

These hashes are provenance markers only. The private/live source files are **not** copied wholesale into this repository.

## Live mechanisms extracted

### 1. State-first startup and aggregate resume

Live mechanism:

- compact project resume aggregates runtime health, project Git, memory Git, shared Git, canonical state/checkpoint, and active session/ownership state;
- independent state reads are performed together rather than exposed as serial model-visible calls;
- the live fast-path contract advertises a startup shape equivalent to:
  `system.status -> project.resume -> semantic batch`;
- process enumeration is a fallback diagnostic, not a mandatory startup step.

Public extraction:

- [`../../patterns/orchestration/state-acquisition.md`](../../patterns/orchestration/state-acquisition.md)

Not copied:

- private project registry resolver;
- private canonical memory schema/data;
- machine-specific repository paths.

### 2. DAG batch executor

Live source function family:

- `directBatchCollectRefIds`
- `directBatchResolveRefs`
- `directBatchParallelEligible`
- `nativeDirectBatch`

Observed behavior:

- bounded operation count and concurrency;
- unique operation ids;
- explicit `dependsOn` plus implicit `$ref` dependencies;
- forward/unknown references denied;
- serial and DAG strategies;
- conservative automatic parallelism for read-only kinds;
- explicit parallelism for selected command kinds;
- non-parallel operations become barriers;
- fail-fast by default;
- compact/full/none result capture;
- receipt reports one semantic outer call vs nested local operation count.

Public extraction:

- [`semantic-batch.mjs`](semantic-batch.mjs)
- [`../../patterns/orchestration/semantic-batching.md`](../../patterns/orchestration/semantic-batching.md)

Changes made for portability:

- all ILYNTO filesystem/process/Git implementations replaced with a dependency-injected `dispatch(kind, args, operation)` function;
- ILYNTO-specific PTY/terminal/process names are not required;
- fixed Windows paths removed;
- limits remain configurable.

### 3. Semantic role enforcement

Live source function family:

- `directSemanticPrepare`
- `nativeDirectSemanticBatch`

Observed semantic steps:

- `inspect`
- `change_verify`
- `finalize`

Observed invariants:

- inspection only accepts known read-only kinds;
- verification cannot use known mutating kinds;
- role ordering is enforced;
- mutation/finalization requires verification;
- every verify operation is automatically made dependent on every mutation/finalization in that semantic step;
- batch fails fast;
- successful mutation steps return compact selected results while retaining evidence metadata for all nested operations.

Public extraction:

- implemented in [`semantic-batch.mjs`](semantic-batch.mjs)
- documented in [`../../patterns/orchestration/semantic-batching.md`](../../patterns/orchestration/semantic-batching.md)

### 4. Explicit DIRECT / GUARD / MANAGED routing

Live source function family:

- `projectGuardCheck`
- `projectRiskClassify`
- `nativeManagedExecute`
- native system routing declaration

Observed behavior:

- DIRECT remains the ordinary path;
- GUARD is exceptional-boundary classification, not a required precheck for every ordinary action;
- stale expected Git HEAD returns `REPLAN` before mutation;
- active conflicting writer returns ownership conflict/replan;
- project capability denial returns `POLICY_DENIED`;
- explicit Human Boundary reasons are small and semantic;
- MANAGED is used when stronger Core policy/governance semantics are materially needed;
- MANAGED failures do not silently fall back to DIRECT;
- alternate control-plane fallback is disabled.

Public extraction:

- [`router.mjs`](router.mjs)
- [`../../patterns/orchestration/routing.md`](../../patterns/orchestration/routing.md)

Not copied:

- private Project Registry policy;
- private Core HTTP token/bootstrap;
- private release authority implementation;
- project-specific capability tables.

### 5. Outer-call / semantic telemetry

Live source function family:

- `orchestrationInstrumentTool`
- semantic batch telemetry writer/aggregator

Observed behavior:

- public/tool calls measured automatically at the tool boundary;
- semantic batch count, nested operations, failures, wall time, roles/kinds and parallelism recorded;
- full tool arguments are not recorded;
- session/project correlation uses compact hashed identity rather than raw identity;
- local JSONL telemetry is bounded/rotated.

Public extraction:

- [`../../patterns/orchestration/telemetry.md`](../../patterns/orchestration/telemetry.md)
- reference engine exposes a telemetry callback instead of imposing a storage backend.

### 6. Focused verification and safety consolidation

Live design evidence shows repeated migration away from:

- full verification after every micro-change;
- remote/control-plane round trip per local operation;
- repeated unchanged status/Git reads;
- model-visible polling;
- duplicated orchestration layers.

The retained guarantees are:

- scope/authority;
- ownership/conflict control;
- source/state fence;
- isolation where shared/live state is involved;
- appropriate verification;
- Human Boundary;
- secret containment;
- truthful evidence.

Public extraction:

- [`../../patterns/orchestration/verification.md`](../../patterns/orchestration/verification.md)
- [`../../patterns/orchestration/anti-patterns.md`](../../patterns/orchestration/anti-patterns.md)

## Security extraction boundary

The live system contains environment-specific security mechanisms. Only portable principles are documented publicly.

Explicitly excluded from public source extraction:

- Windows account names/host identity;
- local absolute paths that reveal private environment layout;
- Secure MCP Tunnel IDs;
- runtime/admin API keys;
- DPAPI encrypted key blobs;
- private tunnel profile content containing account-specific identifiers;
- private canonical memory/project data;
- local security/audit event contents;
- business/customer/financial data;
- private repository credentials;
- release secrets/tokens.

The public pattern may describe mechanisms such as local-only binding, secret-path containment, transport attestation, startup integrity checks, or bounded audit, but should use placeholders/generic implementations rather than publish the private deployment state.

## Reference-code verification

The first portable extraction was tested locally with Node's built-in test runner.

Acceptance covered:

- mutating capability denied in `inspect`;
- mutation semantic step denied without verification;
- verification dependency automatically includes all mutations;
- `$ref` data dependency resolution;
- forward-reference rejection;
- safe read parallelism;
- mutation barrier ordering;
- fail-fast behavior;
- semantic telemetry/evidence receipt;
- routine DIRECT route;
- stale-fence REPLAN;
- Human Boundary classification;
- explicit MANAGED route;
- no automatic route fallback.

Result at extraction time: **14 tests passed, 0 failed**.

## Maintenance rule

Future changes to this pattern should keep three things separate:

1. **Observed live mechanism** — what has actually been proven in a real environment.
2. **Portable public contract** — the provider/environment-neutral rule worth reusing.
3. **Reference implementation** — one implementation of that contract, not a mandatory runtime.

If a future implementation is only theoretical, mark it `PROPOSAL` until it has evidence.
