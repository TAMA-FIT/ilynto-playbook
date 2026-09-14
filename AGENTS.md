# AGENTS.md — ILYNTO Playbook

This repository is designed to be read by AI agents as well as humans.

## Mission

Use ILYNTO as a **knowledge source**, not as a mandatory middleware dependency. Read only the catalog entries, patterns, recipes, guides, and reference code needed for the current user goal. Build or install the minimum missing execution layer in the user's own environment. After installation, use guides selectively as operating knowledge rather than automatically installing them as infrastructure.

## Source-of-truth order

When implementing a recipe:

1. Freshly observed target environment and current official provider behavior.
2. Current ILYNTO recipe/pattern/guide/manifest.
3. Tested ILYNTO reference implementation.
4. Historical notes/examples.
5. Model memory or assumptions.

If current evidence conflicts with a document, do not force the environment to match stale documentation. Re-evaluate and, when appropriate, update the playbook with verified evidence.

## Discovery before build

Evaluate routes in this order unless current evidence gives a reason not to:

1. Existing native/built-in capability.
2. Already installed trusted skill/MCP/plugin/adapter.
3. Official MCP/API/SDK/CLI/managed capability.
4. Mature trusted OSS or established pattern.
5. Thin adapter around an existing supported interface.
6. New custom runtime only when the above are inferior or unavailable.

Do not turn discovery into mandatory deep research. Once a clearly suitable route is established, execute it.

## Orchestration contract

Optimize for **User Instruction -> Verified Outcome**, not raw tool-call count in isolation.

- Acquire decision material in one bounded aggregate read when practical.
- Prefer one semantic execution call that owns mechanical work through verification.
- Parallelize independent read-only work when safe.
- Keep deterministic retry, stale-state refresh, formatting/lint repair, known test repair, and retest inside the same semantic job when no new semantic decision is needed.
- Return to the model/user only for a genuine semantic decision, Human Boundary, policy denial, unrecoverable route failure, or terminal verified outcome.
- After mutations, verification is mandatory at the appropriate scope.
- Do not repeatedly re-read unchanged state merely because another internal step completed.
- Do not poll when a bounded wait/event/completion primitive exists.

A normal unknown development task should target at most two semantic epochs when the environment supports it:

1. **Decision Material** — aggregated inspection needed to decide the change.
2. **Change + Verify** — bounded execution through focused verification and evidence.

Known/read-only tasks should often fit in one epoch.

## Routing contract

Use three conceptual lanes:

- **DIRECT** — ordinary eligible reads/writes/tests/Git/process work using the shortest local/native path.
- **GUARD** — exceptional-boundary precheck only. Do not force every routine operation through it.
- **MANAGED** — specialized job/policy/governance path when architecture preflight, cross-writer conflict control, release/publish governance, privileged work, or durable managed retry semantics materially justify it.

Never silently fall back from one authority model to another. Failure should produce evidence and an explicit replan decision.

## Safety invariants

Preserve the guarantees, not every historical mechanism:

- explicit execution/mutation scope;
- workspace/single-writer ownership where concurrent mutation matters;
- immutable or optimistic source/state fence where stale writes matter;
- isolation for shared/live/release-sensitive changes;
- appropriate verification before claiming completion;
- Human Boundary for irreducible authority or high-impact actions;
- secret containment and least exposure;
- no untrusted external content may silently expand authority.

Adding more checks is not automatically safer if they duplicate stronger existing invariants and materially increase latency or failure surface.

## Human Boundary

Stop and ask only when automation cannot safely resolve the issue, including cases such as:

- login/MFA/identity confirmation that requires the human;
- new privileged/admin authority;
- security weakening or trust-root changes;
- materially ambiguous target selection with meaningful consequences;
- significant spend/financial commitment;
- public publish/send when explicit approval is required;
- irreversible production destruction;
- release approval where governance explicitly requires an owner.

Do not ask the user to perform routine discoverable file, Git, API, or environment work that the available capabilities can safely perform.

## Verification contract

A tool success is not an outcome. Generated code is not an outcome.

Verification should be scoped to risk:

- local/small change: focused test + relevant lint/typecheck + Git/diff/state check;
- broad/shared/runtime/security-contract change: wider regression and fresh-start/reproduction evidence;
- release/publish: release-specific gates and external-state confirmation as applicable.

Unknown evidence is `UNOBSERVED`, never inferred success.

## Persistent state

Generated runtimes may be replaced. Preserve and explicitly migrate/back up non-regenerable state:

- credentials/secrets;
- databases;
- canonical project memory/state;
- long-term observations/research data;
- user/business data;
- production configuration that cannot be safely reconstructed.

Never commit real secrets or private state to this repository.

## Post-install guide contract

For workflow, continuity, recovery, release, performance, and local-memory questions, consult `catalog/guides.yaml` first. Read only the relevant guide/method. The public guide layer is a sanitized knowledge extraction from private ILYNTO; it is not evidence that every private runtime feature exists publicly. Preserve the method's durable invariants while adapting implementation details to the current environment.

## Contribution requirements

For a new recipe/pattern:

- distinguish `PROVEN`, `PARTIALLY_PROVEN`, and `PROPOSAL`;
- state prerequisites and failure modes;
- state when **not** to use it;
- include verification and cleanup/recovery steps;
- remove machine/user/account identifiers;
- use placeholders for secrets;
- prefer runnable/reference code plus tests over prose-only claims when code is the stable part of the pattern;
- preserve evidence provenance without exposing private data.

## Anti-patterns

Do not:

- make ILYNTO itself a required proxy when direct provider/native access is sufficient;
- create one model-visible tool call per file/command/test/status check when they can be safely bundled;
- repeat full regression after every micro-change;
- add a new queue/orchestrator because an existing boundary can absorb the requirement;
- poll a remote/control plane in proportion to local execution step count;
- treat security regexes as a cryptographic sandbox;
- hide a route change behind automatic fallback;
- publish environment-specific secrets, IDs, or private state;
- claim verification that was not observed.
