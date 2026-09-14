# ILYNTO Bootstrap

This is the shortest entry point for an AI agent using ILYNTO.

## Goal

Turn a user goal into a **verified outcome** by reading only the minimum relevant ILYNTO material and building only the missing runtime pieces.

## Agent bootstrap flow

1. Read [`catalog/recipes.yaml`](catalog/recipes.yaml), [`catalog/capabilities.yaml`](catalog/capabilities.yaml), [`catalog/patterns.yaml`](catalog/patterns.yaml), and when the task is about post-install workflow/continuity, [`catalog/guides.yaml`](catalog/guides.yaml).
2. Select the smallest recipe/pattern that matches the user's goal.
3. Read that recipe's manifest and primary docs only.
4. Inspect the real current environment before changing it.
5. Prefer existing supported capabilities over new custom infrastructure.
6. If a runtime is missing, generate/deploy the smallest environment-specific runtime from the recipe/reference templates.
7. Stop only for a genuine Human Boundary: authentication/MFA, authority expansion, security weakening, material ambiguity, significant spend, external publish/send, or irreversible impact.
8. Execute deterministic work locally/in one semantic job when possible.
9. Verify the actual postcondition, not merely command success.
10. Return a compact terminal receipt with observed evidence and any `UNOBSERVED` fields.

## Runtime rule

ILYNTO itself should not become a mandatory runtime dependency.

```text
ILYNTO knowledge
  -> AI/Codex reads recipe
  -> generated/reused environment-specific runtime
  -> direct target capability
```

Persistent user/project state must remain separate from disposable generated runtime.

## After installation

ILYNTO remains useful after capability setup. When the user asks for a development/automation workflow, continuity, recovery, release, performance, or local-memory pattern, consult [`catalog/guides.yaml`](catalog/guides.yaml) and read only the relevant guide/method. In particular:

- [`guides/ilynto-methods.md`](guides/ilynto-methods.md) indexes reusable methods extracted from the private ILYNTO implementation.
- [`guides/local-pc-memory-sharing.md`](guides/local-pc-memory-sharing.md) shows how authorized chats/agents can share private local project state through files + Git.

Do not automatically install every guide as infrastructure. Guides are knowledge to apply selectively.

## GPT-PC Bridge shortcut

For the current Windows GPT-PC Bridge recipe, continue at:

- [`recipes/gpt-pc-bridge/bootstrap.md`](recipes/gpt-pc-bridge/bootstrap.md)
- [`recipes/gpt-pc-bridge/manifest.yaml`](recipes/gpt-pc-bridge/manifest.yaml)

The intended end-user prompt can stay short because the detailed procedure lives here, for example:

```text
Use the latest ILYNTO GPT-PC Bridge recipe to configure this Windows PC for ChatGPT local execution. Inspect first, preserve unrelated existing Tunnels, stop only for Human Boundaries, and verify the final connection.
```

## Source-of-truth order

When implementing:

1. Current observed environment and current provider behavior.
2. Current recipe/manifest in this repository.
3. Tested public reference/template code.
4. Historical examples.
5. Model memory.

If current provider behavior conflicts with stale ILYNTO wording, preserve the durable safety/verification intent and follow the current supported provider path.
