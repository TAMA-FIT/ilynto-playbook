# ILYNTO Playbook

**ILYNTO is an open AI capability engineering playbook.** It teaches AI systems how to connect to computers, APIs, tools, and services through the shortest verified execution path.

ILYNTO is **not** a runtime that every user must install, a proxy that every action must pass through, or a replacement for official MCP/API/CLI integrations. The repository is the durable knowledge layer. An AI agent can read the relevant recipe or pattern, inspect the current environment, and create only the runtime components that are actually missing.

> Knowledge is durable. Runtime is disposable. User state is not disposable.

## Why this exists

Modern AI agents can already write code and call tools. The harder problem is turning that capability into a reliable real-world outcome without wasting model turns, adding unnecessary infrastructure, or weakening verification and safety.

ILYNTO captures practical patterns for:

- discovering the best available capability before building a new one;
- connecting ChatGPT or another agent to local computers and external services;
- using MCP, APIs, SDKs, CLIs, local scripts, workers, or browser control appropriately;
- compressing many deterministic operations into a small number of semantic outer calls;
- keeping mechanical retry, repair, and verification inside the execution boundary;
- escalating only true semantic decisions and Human Boundaries;
- preserving Git/state fences, evidence, security boundaries, and reproducibility;
- generating environment-specific runtimes instead of forcing a universal heavyweight runtime.

## No installation required

If your AI can read this repository, it can use ILYNTO as a reference directly. Cloning the repository is optional and should only be done when local templates, tests, or reference code are useful.

A future end-user instruction can be as small as:

```text
Read the latest ILYNTO GPT-PC Bridge recipe and configure this Windows PC accordingly.
Inspect the environment first, use the shortest supported path, preserve the documented safety boundaries, and verify the final connection.
```

The detailed procedure belongs in this repository, not in a giant prompt.

## Core operating model

```text
User Goal
   |
   v
AI / Agent
   |
   +--> read ILYNTO catalog/pattern/recipe only as needed
   |
   v
Choose shortest eligible capability path
   |
   +--> native integration / official MCP
   +--> official API / SDK / CLI
   +--> trusted existing implementation
   +--> thin adapter or generated runtime only when needed
   |
   v
Bounded execution
   |
   v
Focused verification / evidence
   |
   +--> COMPLETE_VERIFIED
   +--> SEMANTIC_DECISION_REQUIRED
   +--> HUMAN_BOUNDARY
   +--> POLICY_DENIED
   +--> TERMINAL_FAILURE
```

## Non-negotiable principles

1. **Fresh evidence outranks stale summaries.** Inspect the real environment when correctness depends on current state.
2. **Prefer an existing supported capability over custom construction.** Do not rebuild what an official MCP/API/CLI already provides well.
3. **One user goal should remain one semantic job until a meaningful terminal/boundary state.** Internal file reads, commands, tests, retries, and Git checks are not separate user goals.
4. **Compress mechanical work, not semantic decisions.** Batch deterministic operations locally; return to the model only when reasoning is actually required.
5. **Verification is part of execution.** A command succeeding or code being generated is not completion.
6. **Use fewer, stronger safety invariants.** Do not add a remote approval/check/poll to every ordinary operation merely to feel safer.
7. **No silent fallback across authority models.** A failed route should return evidence and replan explicitly rather than secretly switching to a different trust boundary.
8. **Runtime is reproducible; persistent state is protected.** Credentials, databases, memory, business data, and observation history must never be treated as disposable generated artifacts.
9. **Secrets never belong in this repository.** Examples use placeholders and environment-independent contracts.
10. **Human interaction is a boundary, not an orchestration primitive.** Ask only for irreducible identity, consent, authority expansion, material ambiguity, significant spend, external publish/send, or irreversible impact.

## Repository map

```text
catalog/                 Machine-readable index for agents
patterns/                Reusable architecture and execution patterns
  orchestration/         Fast verified intent-to-outcome patterns
references/              Sanitized reference implementations derived from proven systems
recipes/                 End-to-end task recipes (added incrementally)
skills/                  Agent-consumable skills (added incrementally)
templates/               Reusable generated-runtime templates (added incrementally)
tests/                   Tests for reference implementations
AGENTS.md                 Rules for AI agents reading/contributing to this repository
```

## First extracted system: fast verified orchestration

The first public pattern is derived from a live local ILYNTO deployment that evolved through repeated latency, safety, and reproducibility work. The transferable mechanisms are documented under [`patterns/orchestration/`](patterns/orchestration/README.md), with sanitized executable reference code under [`references/orchestration/`](references/orchestration/).

The public extraction intentionally excludes machine-specific paths, user identities, private project registry data, tunnel identifiers, credentials, encrypted credential blobs, private memory, and business data.

## Status

This repository is being built evidence-first. A capability is marked proven only when it has a real implementation/evidence basis. Untested ideas must be labeled as proposals rather than presented as working instructions.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
