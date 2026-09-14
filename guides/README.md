# ILYNTO Guides

Guides are **post-install usage knowledge**. They are intentionally different from recipes.

- A **recipe** describes how to reach an end-to-end capability such as GPT-PC Bridge.
- A **pattern** captures a reusable engineering mechanism such as semantic batching or verification fences.
- A **guide** explains how to combine those capabilities/patterns in real work after the connection already exists.

The guide layer exists so a user can keep using the public ILYNTO Playbook after installation as a living reference rather than treating it as a one-time installer.

## Current guides

- [`local-pc-memory-sharing.md`](local-pc-memory-sharing.md) — use local files + Git + the GPT-PC bridge as a shared memory surface across chats/agents/sessions.
- [`ilynto-methods.md`](ilynto-methods.md) — a curated index of durable operating methods extracted from the maintainer's long-running private ILYNTO implementation.

## How an AI should use guides

When the user asks for a workflow rather than a new connection:

1. inspect the current environment first;
2. read [`../catalog/guides.yaml`](../catalog/guides.yaml);
3. choose only the relevant guide/method;
4. adapt the concept to the user's environment instead of copying private machine-specific implementation details;
5. preserve the safety/verification invariants from the guide;
6. verify the actual outcome.

Do not force a guide into every task. The Playbook is a reference library, not a mandatory runtime dependency.
