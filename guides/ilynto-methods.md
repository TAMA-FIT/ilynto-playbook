# ILYNTO Operating Methods

Status: **GUIDE / CURATED KNOWLEDGE INDEX**

This guide collects durable operating methods extracted from the maintainer's long-running private ILYNTO implementation. It is not a dump of the private runtime. Machine-specific paths, credentials, private registry data, business data, and implementation-only compatibility layers are intentionally excluded.

The purpose is simple:

> After GPT-PC Bridge or another capability is installed, an AI can consult this public Playbook and reuse the working methods that were learned through years of ILYNTO development.

Use the method that fits the task. Do not install all of them as infrastructure by default.

---

## Method 1 — Fresh state before meaningful mutation

**Use when:** current files, Git, runtime state, provider state, or account state can change independently of the conversation.

**Core idea:**

```text
conversation summary / memory
        +
compact saved project state
        |
        v
fresh targeted observation
        |
        v
mutation decision
```

Fresh observable state outranks stale summaries. Prefer a compact aggregate read over repeatedly fetching the same files/state one by one.

**Avoid:** starting a mutation solely because an earlier chat says the state was safe.

Related public material: [`../patterns/orchestration/`](../patterns/orchestration/README.md).

---

## Method 2 — Canonical local project memory

**Use when:** multiple chats, agents, or sessions need durable continuity.

Keep project memory separate from runtime/source and represent the current generation with compact state, checkpoint, handoff, optional decisions, and a hash manifest.

```text
verified work
-> checkpoint
-> canonical manifest
-> exact Git commit
-> later resume + fresh validation
```

Memory is a continuation surface, not a replacement for real-state inspection.

Related guide: [`local-pc-memory-sharing.md`](local-pc-memory-sharing.md).

---

## Method 3 — One intent -> one verified outcome

**Use when:** a user asks for one semantic job containing many mechanical substeps.

Keep the task as one semantic unit:

```text
one user intent
-> plan / bounded operations
-> local execution
-> tests/verification
-> final state evidence
-> checkpoint
-> COMPLETE_VERIFIED
```

Do not force the model/user to approve or reason about every file read, command, test, and retry when those actions are deterministic and inside the same authority boundary.

If the work succeeds but checkpointing fails, repair the checkpoint; do **not** replay the already-completed work.

---

## Method 4 — DIRECT by default, heavier orchestration only when justified

**Use when:** choosing between direct capability calls and a managed workflow engine.

Default to the shortest eligible path.

```text
DIRECT
  routine bounded work

GUARD
  exceptional boundary/precheck only

MANAGED
  architecture-sensitive, recovery-heavy, policy-heavy, or multi-step verified job
```

Do not put every ordinary operation behind a remote queue, approval broker, orchestration engine, or polling loop.

Related public material: [`../patterns/orchestration/routing.md`](../patterns/orchestration/routing.md).

---

## Method 5 — Semantic batching / orchestration compression

**Use when:** a task contains many deterministic local operations.

Bundle operations around semantic phases rather than exposing every primitive operation to the model.

```text
Fresh decision material
-> semantic batch
   -> local reads
   -> local edits
   -> local commands/tests
-> focused verification
-> compact receipt
```

Safe independent reads can run in parallel. Mutations create barriers where ordering matters.

Target normal development work at a small number of model-visible semantic epochs rather than dozens of outer calls.

Related public implementation: [`../references/orchestration/semantic-batch.mjs`](../references/orchestration/semantic-batch.mjs).

---

## Method 6 — Risk-scoped safety

**Use when:** a tool surface contains both harmless and high-impact capabilities.

Apply protection proportional to the operation rather than applying maximum friction everywhere.

A useful conceptual scale:

```text
R0  read-only
R1  local reversible mutation
R2  external/provider write
R3  privileged / irreversible / unknown authority expansion
```

Read-only and routine local work should stay fast. Human Boundary belongs at identity/authority/security/external-impact boundaries.

Do not optimize away verification, source fences, or explicit authority expansion.

---

## Method 7 — Fixed completion predicates

**Use when:** a task can appear successful before its real postcondition is proven.

Define the final verification condition before execution.

Examples:

```text
edit -> targeted test -> git diff/status
publish -> provider response -> public fetch/readback
runtime start -> process_running + healthy + ready
file replace -> new hash/readback
```

A zero exit code is evidence of command execution, not necessarily task completion.

---

## Method 8 — Source/Git/state binding

**Use when:** stale observations or concurrent changes could make a mutation unsafe.

Bind important mutations to the state they were planned against:

- expected file SHA before replace/delete;
- expected Git HEAD before commit;
- current Git status digest for sensitive recovery;
- provider object ID rather than display name;
- deployment UUID + provider metadata rather than name-only resource reuse.

On mismatch, stop/replan. Do not silently overwrite drift.

---

## Method 9 — No silent fallback across authority models

**Use when:** the preferred route fails.

Failure should produce evidence and an explicit replan rather than secretly switching to a broader or less-safe route.

Examples of bad silent fallback:

```text
official tunnel fails -> expose a public unauthenticated port
bounded file tool fails -> use unrestricted Administrator shell
verified managed job fails -> mutate directly without the failed-job binding
```

Different authority models require an explicit decision.

---

## Method 10 — Bound recovery to the failed state

**Use when:** retrying or repairing a failed mutation.

A recovery authorization should be short-lived and bound to the failed job/state rather than becoming a permanent bypass.

Useful bindings include:

```text
project
run/job id
failed step
capability
failed result/error digest
planned repair action digest
Git HEAD/status
expiry
single-use flag
```

If those bindings drift, replan instead of applying the stale repair.

This is the durable concept behind ILYNTO's recovery-lease approach.

---

## Method 11 — Discovery/research only when it can change the decision

**Use when:** deciding whether to research architecture/provider options before implementation.

Do not perform broad discovery on every routine edit.

Use discovery when:

- creating/adopting a new project;
- changing architecture/provider boundaries;
- a current route is stale or unsupported;
- there is material uncertainty whose answer changes implementation.

Record the decision/selected route so the same research is not repeated without a recheck signal.

---

## Method 12 — Adopt existing systems before replacing them

**Use when:** an existing project/repository/runtime is already functioning.

Prefer:

```text
inspect
-> understand current source of truth
-> adopt/register
-> preserve working state
-> repair/extend only what is missing
```

Do not rebuild a working project merely because a standard template exists.

This principle applies to repositories, local MCPs, provider resources, credentials, and deployment state.

---

## Method 13 — Separate persistent state from generated runtime

**Use when:** building local agent systems.

Treat these as different classes:

```text
Disposable / reproducible
  runtime
  generated adapter
  cache
  temporary build output

Persistent / protected
  project source
  database
  memory/checkpoints
  credentials
  business/financial observations
  provider resource identity
```

A runtime should be replaceable without losing the user's history or secrets.

This is a core ILYNTO Playbook principle.

---

## Method 14 — Secret-reference transport instead of secret-value transport

**Use when:** a runtime needs credentials.

Prefer passing references such as:

```text
env:OPENAI_RUNTIME_KEY
file:<protected path>
OS credential-store entry name
provider-managed credential reference
```

Do not put raw secrets in:

- Git;
- normal tool arguments;
- prompt history when avoidable;
- public logs;
- canonical project memory.

Admin/management credentials should not be reused as long-lived runtime credentials merely for convenience.

---

## Method 15 — Compact receipts instead of raw execution dumps

**Use when:** returning work to the model/user after a large local operation.

Return decision-relevant evidence:

```yaml
state: COMPLETE_VERIFIED
changed: true
tests: pass
git_head: <sha>
git_clean: true
verification: <digest or concise evidence>
unobserved: []
```

Keep large raw logs locally and surface them only when diagnosis requires them.

This reduces context cost while preserving auditability.

---

## Method 16 — Deterministic continuation, not blind polling

**Use when:** a multi-step local job needs to continue without repeatedly asking the model what to do next.

Mechanical continuation can stay local when the next state is deterministic:

```text
step complete -> run next eligible step
transient retry -> bounded retry
verification complete -> checkpoint
semantic ambiguity -> return to model
Human Boundary -> return to user
```

Do not poll merely because polling is easy. Prefer events/status transitions and bounded rechecks.

---

## Method 17 — Degraded state should be explicit

**Use when:** an optional capability, provider, or acceleration path is unavailable.

Do not pretend full capability still exists. Return a degradation record:

```text
what is unavailable
what still works
whether safety changed
whether correctness changed
whether only performance changed
what restores full state
```

A performance fallback can be acceptable when authority/correctness remain unchanged. A safety/authority fallback requires explicit replanning.

---

## Method 18 — Release is a separate verified outcome

**Use when:** moving from tested local changes to a public/production state.

Separate:

```text
build/test complete
!=
release complete
```

Release can have its own evidence, verification, approval/Human Boundary, promotion, and rollback path.

Do not interpret a Git commit or local test pass as proof that an external deployment is live.

---

## Method 19 — Shared capability surface, specialized policy at the edge

**Use when:** many projects need common filesystem/shell/Git/runtime operations.

Prefer a small shared generic capability surface and keep project/provider-specific policy in recipes/contracts rather than creating a new bespoke MCP tool for every action.

Example:

```text
shared fs/shell/git/process capability
        +
project-specific source boundaries
        +
provider-specific recipe
        +
focused verification
```

This keeps the tool surface understandable and reusable.

---

## Method 20 — Optimize Chat-to-Verified-Outcome, not raw tool latency

**Use when:** tuning agent performance.

The meaningful latency metric is not "how fast did one file read return?" but:

```text
user intent
-> sufficient fresh state
-> execution
-> verification
-> usable terminal answer
```

A slightly slower local batch that eliminates ten model round-trips is usually better than a faster primitive tool that forces repeated reasoning calls.

Do not remove evidence, verification, or Human Boundaries merely to improve benchmark latency.

---

# How to ask an AI to use these methods

A user does not need to remember the method names. Example:

```text
Check the ILYNTO Playbook for the best operating pattern for this task and use only the relevant methods. Keep the shortest supported execution path and verify the real outcome.
```

Or for development:

```text
Use ILYNTO methods for fresh-state inspection, semantic batching, source fences, focused verification, and compact checkpointing while you work on this project.
```

The AI should consult [`../catalog/guides.yaml`](../catalog/guides.yaml) first and read only relevant sections.

# Provenance and scope

These methods are sanitized generalizations of behavior currently present in the maintainer's private ILYNTO implementation, including compact resume, canonical memory, checkpoint/handoff, one-intent verified outcomes, risk envelopes, fixed completion predicates, recovery binding, semantic batching, deterministic continuation, release verification, and degradation tracking.

They are published as **techniques**, not as claims that every private ILYNTO feature has been reproduced in this public repository.
