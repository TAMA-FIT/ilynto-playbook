# Fast Verified Orchestration

Status: **PROVEN**

This pattern is a sanitized extraction of orchestration mechanisms currently used by a live ILYNTO Native MCP deployment. It is intended to be portable: the pattern does not require the original ILYNTO runtime, original project registry, original machine paths, Supabase, or any private state.

The goal is simple:

> Minimize **User Instruction -> Verified Outcome** latency without weakening verification, scope control, source/state fencing, Human Boundaries, or truthful failure handling.

## 1. What this pattern optimizes

Do not optimize raw tool-call count in isolation. Optimize the complete outcome path:

```text
User Instruction
   -> Decision Material
   -> Semantic Change/Execution
   -> Focused Verification
   -> Evidence
   -> Verified Outcome or explicit Boundary
```

A system can have very fast individual tool calls and still be slow if the model must repeatedly return for:

- one file read at a time;
- one command at a time;
- one Git status at a time;
- one test at a time;
- one retry at a time;
- one remote queue/poll cycle per local operation.

The central design move is to shift **mechanical choreography** behind a bounded local execution boundary while leaving **semantic reasoning** with the model.

## 2. Semantic epochs

A useful target for normal development work is:

### Epoch A — Decision Material

Acquire enough current state in one bounded read phase to decide the change.

Typical material:

- project identity/root;
- current Git HEAD/status/diff as relevant;
- targeted source files;
- relevant search results;
- current runtime/health only if it changes the decision;
- current persistent project state/checkpoint when applicable.

Independent reads should be aggregated or safely parallelized.

### Epoch B — Change + Verify

Execute the bounded change and all deterministic verification that does not require a new semantic decision.

Typical work kept inside this epoch:

- edit/apply;
- focused tests;
- lint/typecheck when applicable;
- deterministic formatting/lint repair;
- deterministic stale-hash refresh;
- mechanical Git checks;
- known retryable repair and retest;
- compact evidence collection.

Return to the model only if:

- the specification is genuinely ambiguous;
- a Human Boundary is reached;
- policy denies the operation;
- an external state change creates a new decision;
- no safe/recoverable route remains;
- the requested outcome is verified.

Known read-only work should often fit in one semantic epoch.

## 3. Default flow

```text
Fresh state needed?
  |
  +-- no --> use already-valid decision material
  |
  +-- yes --> aggregate minimum fresh state
                  |
                  v
          choose shortest eligible route
             /        |        \
         DIRECT      GUARD     MANAGED
            |          |           |
            |      boundary?       |
            |          |           |
            +----------+-----------+
                       |
                       v
              bounded semantic batch
                       |
               focused verification
                       |
                       v
        COMPLETE_VERIFIED / explicit boundary
```

## 4. Three execution lanes

### DIRECT — default

Use the shortest local/native path for ordinary authorized work.

Examples:

- file inspection/search/read;
- routine project edits;
- local commands/tests;
- Git status/diff/stage/commit within authorized scope;
- process/runtime inspection;
- deterministic local verification.

DIRECT should not mean "unsafe". It means the safety checks required for ordinary work are implemented in-process/local and do not create unnecessary outer orchestration.

### GUARD — exceptional-boundary precheck

Use only when the operation may cross an authority/safety boundary that needs classification before execution.

Examples:

- privilege/admin expansion;
- weakening security controls;
- significant spend;
- external publish/send;
- irreversible production destruction;
- release approval;
- competing writer ownership.

Do **not** put every ordinary tool call through GUARD. That turns an exceptional boundary into a latency tax.

### MANAGED — specialized verified job path

Use when a stronger job/governance boundary materially adds value, for example:

- architecture preflight;
- complex policy/conflict handling;
- release/publish governance;
- durable managed retry/repair;
- shared/live integration semantics;
- other high-impact workflows where the additional boundary is justified.

MANAGED is not automatically "better" than DIRECT. It is a different execution contract.

### No silent cross-route fallback

If DIRECT fails, do not secretly switch to MANAGED (or another transport/authority model) simply to make the task succeed. Return evidence, re-evaluate, and make the route change explicit. Silent fallback can change authority, latency, persistence, and failure semantics without the model/user knowing.

## 5. Semantic batch contract

The live-derived pattern uses a DAG-capable batch rather than serial model-visible primitives.

Each operation has at minimum:

```yaml
id: unique-id
kind: fs.read | fs.write | shell.run | git.status | test.run | ...
role: inspect | change | finalize | verify
args: {}
dependsOn: []
```

A batch may also reference a prior operation result in an argument:

```json
{ "$ref": "readConfig.sha256" }
```

That reference implicitly creates a dependency.

### Semantic step types

The proven model uses three high-level steps:

- `inspect`
- `change_verify`
- `finalize`

Rules:

- `inspect` permits only read-only operation kinds.
- `change_verify` requires at least one `change` operation and at least one `verify` operation.
- `finalize` requires at least one `finalize` operation and at least one `verify` operation.
- verification operations automatically depend on every mutation/finalization operation in the same semantic step.
- roles must appear in semantic order; do not mutate, then return to inspection as if the mutation never happened.
- fail-fast is the default for a bounded semantic batch.

## 6. Parallelism

Parallelism should be **structural**, not optimistic guessing.

Automatically parallelize operations that are both:

1. independent in the DAG; and
2. known to be safe read-only operations.

Examples:

- multiple independent file stats/reads/searches;
- independent Git status/diff observations;
- runtime/process metadata reads.

Commands may be parallelized only when explicitly known to be independent and when concurrent execution cannot violate workspace ownership or resource assumptions.

Mutation operations generally act as barriers unless the system has a stronger transaction/ownership model proving safe concurrency.

## 7. State-first startup

Do not begin every task by enumerating processes, dumping full registries, or rereading every state file.

Prefer:

```text
system/status summary
   -> aggregate project resume/state if the task needs project context
   -> targeted semantic work
```

Use process listing or deeper diagnostics only when health is missing, stale, contradictory, or directly relevant.

See [`state-acquisition.md`](state-acquisition.md).

## 8. Verification is not optional

After mutation, the batch must contain or lead directly to verification appropriate to the change.

The verification boundary should be **risk-scoped**:

- one local code change: focused test + relevant lint/typecheck + diff/state check;
- shared runtime/security/public contract change: wider regression and fresh-start/reproduction evidence;
- release/publish: release-specific gates plus external-state confirmation where applicable.

Repeated full regression after every micro-change is not safety; it is often duplicated cost. Preserve the guarantee at the meaningful boundary.

See [`verification.md`](verification.md).

## 9. Result compaction

The model does not need every byte produced by every internal operation.

Default result handling:

- always return operation id/kind/success/elapsed time;
- return compact decision-relevant fields;
- truncate large stdout/stderr/search/file content;
- return full output only for explicitly selected operations;
- keep bulky raw diagnostics local or in referenced artifacts when possible;
- never hide the fact that output was truncated.

This reduces context cost without hiding failure.

## 10. Telemetry

Measure the real orchestration outcome, not only individual command speed.

Recommended metrics:

- wall time from semantic request to terminal result;
- outer/model-visible calls;
- semantic batch count;
- nested local operation count;
- operations per outer call;
- failure rate;
- retry/replan count;
- Human Boundary count;
- parallelism/parallel groups;
- focused test/build time;
- bytes returned to the model.

Telemetry should not store full prompts or full tool arguments by default. Hash/session pseudonyms and compact metadata are usually enough.

See [`telemetry.md`](telemetry.md).

## 11. Safety by consolidation

The speed model depends on replacing repeated weak checks with fewer strong invariants.

Portable invariants:

1. **Execution scope** — the job has an explicit target/mutation scope.
2. **Workspace ownership** — conflicting concurrent mutation is prevented where it matters.
3. **Source/state fence** — bind mutation to a known base (Git HEAD, SHA-256, version, ETag, etc.) where stale writes matter.
4. **Isolation** — shared/live/release-sensitive changes stay isolated until their gate.
5. **Verification gate** — the outcome is verified at a scope proportional to risk.
6. **Human Boundary** — irreducible authority remains human-controlled.
7. **Secret containment** — generic execution does not silently expose credentials/trust roots.
8. **Truthful evidence** — unknown state is reported as unknown, not inferred success.

Do not preserve a historical queue, database round trip, lock check, or policy layer merely because it once implemented one of these guarantees. Preserve the guarantee; replace redundant mechanisms when parity evidence exists.

## 12. What was deliberately not copied from the original system

The portable pattern excludes:

- local Windows usernames/hostnames;
- fixed local paths;
- private project registry entries;
- private canonical memory;
- Tunnel IDs/API keys/encrypted credential files;
- business/project data;
- provider-specific legacy control-plane transport;
- release-specific internal version numbers and SHAs;
- implementation details that only make sense inside the original monolithic Core.

The provenance and extraction boundary are documented in [`../../references/orchestration/live-provenance.md`](../../references/orchestration/live-provenance.md).

## 13. Reference implementation

The reusable algorithmic core is provided as dependency-injected JavaScript rather than a copy of the original server:

- [`semantic-batch.mjs`](../../references/orchestration/semantic-batch.mjs) — DAG batching, result references, semantic role enforcement, verification dependency, fail-fast, result compaction.
- [`router.mjs`](../../references/orchestration/router.mjs) — explicit DIRECT/GUARD/MANAGED/HUMAN_BOUNDARY routing policy without silent fallback.

These references intentionally know nothing about ILYNTO-specific project paths or credentials. A generated runtime supplies its own dispatcher, policy, and capability implementations.

Run the reference tests with:

```bash
npm test
```
