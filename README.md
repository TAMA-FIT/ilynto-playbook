# ILYNTO Playbook

**ILYNTO is an open AI capability engineering playbook.** It teaches AI systems how to connect to computers, APIs, tools, and services through the shortest verified execution path.

ILYNTO is **not** a runtime that every user must install, a proxy that every action must pass through, or a replacement for official MCP/API/CLI integrations. The repository is the durable knowledge layer. An AI agent can read the relevant recipe or pattern, inspect the current environment, and create only the runtime components that are actually missing.

> Knowledge is durable. Runtime is disposable. User state is not disposable.

**Start here:** [`BOOTSTRAP.md`](BOOTSTRAP.md) gives an AI agent the shortest repository entry path.

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
catalog/                 Machine-readable indexes for agents
patterns/                Reusable architecture and execution patterns
  orchestration/         Fast verified intent-to-outcome patterns
recipes/                 End-to-end capability recipes
references/              Sanitized evidence and reusable reference implementations
templates/               Portable runtime/configuration templates
skills/                  Agent-consumable skills (added incrementally)
tests/                   Reference and clean-room-oriented tests
AGENTS.md                 Rules for AI agents reading/contributing to this repository
```

## Fast verified orchestration

The first public pattern is derived from a live local ILYNTO deployment that evolved through repeated latency, safety, and reproducibility work. The transferable mechanisms are documented under [`patterns/orchestration/`](patterns/orchestration/README.md), with sanitized executable reference code under [`references/orchestration/`](references/orchestration/).

The public extraction intentionally excludes machine-specific paths, user identities, private project registry data, tunnel identifiers, credentials, encrypted credential blobs, private memory, and business data.

## Current recipe: GPT-PC Bridge for Windows

[`recipes/gpt-pc-bridge/`](recipes/gpt-pc-bridge/README.md) describes how an AI provisioning agent can give ChatGPT bounded local Windows capabilities through OpenAI Secure MCP Tunnel.

The current clean-install preference is:

```text
ChatGPT
  -> supported Plugin/App/binding
  -> Secure MCP Tunnel, channel=main
  -> tunnel-client managed runtime
  -> local stdio MCP
  -> Windows filesystem / shell / process / Git
```

The recipe starts at [`recipes/gpt-pc-bridge/bootstrap.md`](recipes/gpt-pc-bridge/bootstrap.md). The repository includes a portable stdio MCP template under [`templates/gpt-pc-bridge/mcp/`](templates/gpt-pc-bridge/mcp/README.md), a standalone runtime builder at [`templates/gpt-pc-bridge/build-runtime.mjs`](templates/gpt-pc-bridge/build-runtime.mjs), a tunnel configuration reference under [`templates/gpt-pc-bridge/tunnel/`](templates/gpt-pc-bridge/tunnel/README.md), and local official-tunnel-client E2E evidence under [`references/gpt-pc-bridge/`](references/gpt-pc-bridge/local-tunnel-e2e.md).

The recipe remains **PARTIALLY_PROVEN**, not fully proven, until a separate unrelated Windows PC and OpenAI account reproduce the hosted-tunnel + ChatGPT-binding path from this public repository alone. Local MCP behavior and local `tunnel-client -> stdio MCP` integration are already covered by automated/reproducible tests.

## Machine-readable entry points

Agents should prefer the catalog before reading the entire repository:

- [`catalog/bootstrap.yaml`](catalog/bootstrap.yaml)
- [`catalog/patterns.yaml`](catalog/patterns.yaml)
- [`catalog/capabilities.yaml`](catalog/capabilities.yaml)
- [`catalog/recipes.yaml`](catalog/recipes.yaml)

This keeps the prompt small: the agent can identify the relevant recipe/pattern first, then read only the required files.

## Status discipline

This repository is built evidence-first. A capability is marked proven only when it has a real implementation/evidence basis. Untested ideas are labeled as proposals or partial proofs rather than presented as working instructions.

Provider-specific behavior can change independently of this repository. Recipes separate durable architecture from provider-version facts and direct provisioning agents to current official documentation or installed CLI help where appropriate.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
