# Secure MCP Tunnel Template Notes

Production Tunnel naming, deployment identity, safe reuse, and creation policy are normative in [`../../../recipes/gpt-pc-bridge/tunnel-provisioning.md`](../../../recipes/gpt-pc-bridge/tunnel-provisioning.md). Do not reuse an arbitrary Tunnel merely because one already exists in the same OpenAI account/workspace.

This directory contains **reference configuration only**. Prefer letting the current official `tunnel-client` generate and validate profiles through its supported commands instead of hand-maintaining YAML.

The included [`profile.stdio.example.yaml`](profile.stdio.example.yaml) exists to make the architecture readable and to give an AI agent a fallback reference when diagnosing a generated profile.

[`deployment-state.example.json`](deployment-state.example.json) documents the non-secret local state that binds one Windows deployment to one exact remote Tunnel. A real deployment state file belongs in the generated user-local runtime area, not in Git.

## Production identity

Default remote Tunnel name:

```text
ILYNTO GPT-PC Bridge - <device-label>
```

Default local runtime alias:

```text
ilynto-gpt-pc-bridge-<device-slug>
```

The description should include the ILYNTO ownership marker, recipe id, and deployment UUID. Use [`../../../references/gpt-pc-bridge/deployment-identity.mjs`](../../../references/gpt-pc-bridge/deployment-identity.mjs) as the canonical public reference for generating and validating that identity.

Display-name equality is never sufficient for automatic reuse.

## Current shortest path

For the currently observed `tunnel-client 0.0.14`, the built-in local stdio sample states:

- local stdio MCP is the shortest first-use path when a local MCP command already exists;
- the command is bound to `channel=main`;
- stdio skips HTTP OAuth discovery because there is no HTTP protected-resource metadata endpoint;
- long-lived Codex-managed use should prefer `tunnel-client runtimes connect`;
- `runtimes connect` can create/reuse a remote Tunnel alias when given the required remote scope/authorization, or attach an explicitly supplied Tunnel ID;
- after connect, query `tunnel-client runtimes status <alias>` and require current evidence of process running, healthy, and ready.

Always inspect the installed binary before using exact flags:

```powershell
tunnel-client --version
tunnel-client help quickstart
tunnel-client profiles samples show sample_mcp_stdio_local
tunnel-client runtimes connect --help
tunnel-client runtimes status --help
```

## One active stdio instance per Tunnel

Do not intentionally run multiple active stdio tunnel-client instances against the same Tunnel ID. Each instance owns its own MCP child and requests can otherwise be split across different child processes. Stop/reuse the verified same-deployment managed runtime or use a separate Tunnel ID for an intentionally independent deployment.

## Credentials

The examples contain no real credentials.

Use a runtime-key reference such as:

```yaml
api_key: "env:CONTROL_PLANE_API_KEY"
```

Keep the Admin API key out of the long-lived daemon. It is only for Tunnel CRUD when that administrative route is intentionally used.

## Health listener

The example uses `127.0.0.1:0` so a clean-room run can choose a free loopback port instead of colliding with an existing local service. A provisioning agent may use a stable loopback port when that better fits the user's environment.

Never bind the tunnel operator/health UI publicly merely for convenience.
