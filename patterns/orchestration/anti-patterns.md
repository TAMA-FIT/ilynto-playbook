# Orchestration Anti-Patterns

Status: **PROVEN / derived from observed optimization work**

These patterns repeatedly create avoidable latency, model-context growth, or failure surface.

## 1. One outer call per primitive

Bad:

```text
read file A
-> model
read file B
-> model
git status
-> model
edit A
-> model
test
-> model
git diff
-> model
```

Use aggregate reads and semantic batches when the intermediate results do not require a new semantic decision.

## 2. Status polling as reassurance

Bad:

```text
start command
-> poll
-> poll
-> poll
-> poll
```

Prefer a bounded wait, event, detached completion primitive, or one terminal collection. Poll only when the external system genuinely requires it.

## 3. Full regression after every edit

This can make the verification machinery dominate development time.

Use focused verification inside the local change loop and retain the full gate at the meaningful integration/release boundary.

## 4. Safety by repeated remote choreography

Adding a network/database/model approval call before every ordinary local operation can increase both latency and the number of components that can fail.

Prefer static/in-process policy and a small number of strong invariants for routine work. Reserve heavier governance for exceptional boundaries.

## 5. Hidden route fallback

Bad:

```text
local/direct failed
-> silently switch to managed/cloud/alternate account
```

A route change can alter authority and persistence. Return the failure and replan explicitly.

## 6. Re-reading state the job already owns

If the runtime itself performed the write and has exclusive workspace ownership, repeatedly asking the external control plane for the same unchanged state is usually waste.

Refence when there is an external-change signal or when the invariant requires it.

## 7. Treating transport as the execution bus

Bad architecture:

```text
one local file read = one cloud RPC
one local edit = one cloud RPC
one test = one cloud RPC
one Git check = one cloud RPC
```

Transport/control planes should carry semantic jobs, leases/checkpoints/boundaries, and terminal receipts—not scale linearly with local execution step count.

## 8. Dumping full capability catalogs every task

Use targeted capability search/indexes. Full catalog enumeration should be a fallback for discovery, not a startup ritual.

## 9. New orchestrator for every new concern

Before adding a queue/service/router, ask whether the concern can be absorbed into an existing dispatcher, policy boundary, semantic job, or verification gate.

Prefer deleting/merging layers when guarantees can remain explicit.

## 10. Returning every byte to the model

Raw logs, huge file contents, and complete search results consume context and slow reasoning.

Return bounded decision material plus evidence references. Preserve truncation metadata.

## 11. Confusing progress with completion

"Command ran", "file was written", "build started", and "code generated" are progress states.

Completion requires fresh evidence of the requested outcome.

## 12. Asking the user to reconstruct discoverable state

Do not ask the user for paths, project identity, Git state, or provider metadata that the system can safely discover itself.

Use Human Boundaries only for irreducible human authority/ambiguity.

## 13. Making runtime state canonical

Generated code, temporary workers, process IDs, and local orchestration wrappers can be rebuilt.

Do not mix them with irreplaceable canonical user/project data. Keep reproducible runtime artifacts separate from persistent state.

## 14. Security regex as a sandbox claim

Command/path classifiers can reduce blast radius but do not make same-user generic shell cryptographically isolated.

State residual risk accurately. Use OS/container/sandbox boundaries when actual isolation is required.

## 15. Optimizing only the fastest microbenchmark

A specialized read path may win a pure-read benchmark while a semantic batch wins a mutation/test workflow. Keep workload-aware measurements and optimize the actual user-to-outcome path.
