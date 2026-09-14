# Secure MCP Tunnel Template Notes

This directory contains **reference configuration only**. Prefer letting the current official `tunnel-client` generate and validate profiles through its supported commands instead of hand-maintaining YAML.

The included [`profile.stdio.example.yaml`](profile.stdio.example.yaml) exists to make the architecture readable and to give an AI agent a fallback reference when diagnosing a generated profile.

## Current shortest path

For the currently observed `tunnel-client 0.0.14`, the built-in local stdio sample states:

- local stdio MCP is the shortest first-use path when a local MCP command already exists;
- the command is bound to `channel=main`;
- stdio skips HTTP OAuth discovery because there is no HTTP protected-resource metadata endpoint;
- long-lived Codex-managed use should prefer `tunnel-client runtimes connect`;
- after connect, query `tunnel-client runtimes status <alias>` and require current evidence of process running, healthy, and ready.

Always inspect the installed binary before using these exact flags:

```powershell
tunnel-client --version
tunnel-client help quickstart
tunnel-client profiles samples show sample_mcp_stdio_local
tunnel-client runtimes connect --help
tunnel-client runtimes status --help
```

## One active stdio instance per tunnel

Do not intentionally run multiple active stdio tunnel-client instances against the same Tunnel ID. Each instance owns its own MCP child and requests can otherwise be split across different child processes. Stop/reuse the existing managed runtime or use a separate Tunnel ID for an intentionally independent instance.

## Credentials

The example contains no real credentials.

Use a runtime-key reference such as:

```yaml
api_key: "env:CONTROL_PLANE_API_KEY"
```

Keep the Admin API key out of the long-lived daemon. It is only for tunnel CRUD when that administrative route is intentionally used.

## Health listener

The example uses `127.0.0.1:0` so a clean-room run can choose a free loopback port instead of colliding with an existing local service. A provisioning agent may use a stable loopback port when that better fits the user's environment.

Never bind the tunnel operator/health UI publicly merely for convenience.
