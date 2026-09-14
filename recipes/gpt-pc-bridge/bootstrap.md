# GPT-PC Bridge — Bootstrap from a Windows PC

Status: **LOCAL BUILD/TRANSPORT PROVEN / CLEAN-ROOM ACCOUNT RUN PENDING**

This is the operational start page for Codex or another capable local coding agent. It should be sufficient to route the rest of the recipe without a giant user prompt.

## 1. Read only what you need

Read in this order:

1. [`manifest.yaml`](manifest.yaml)
2. [`setup.md`](setup.md)
3. [`tunnel-provisioning.md`](tunnel-provisioning.md)
4. [`security.md`](security.md)
5. [`verify.md`](verify.md)

Use [`troubleshooting.md`](troubleshooting.md) only when a gate fails. Use [`official-sources.md`](official-sources.md) when provider behavior/availability needs current verification.

## 2. Inspect before installing

Collect current evidence for:

```text
Windows version / architecture
current user / elevation state
Node.js / npm
Git
PowerShell
tunnel-client
existing ILYNTO GPT-PC deployment state
existing tunnel-client local runtime aliases
```

Do not reinstall or replace a functioning prerequisite merely because this recipe lists it.

## 3. Obtain missing prerequisites from trusted sources

### Node.js / npm

The public MCP template requires Node.js 20+.

If Node is missing or too old, use a current supported Node.js distribution from the official project or a trusted OS/package-manager route. Verify `node --version` and `npm --version` after installation.

### Git

Git is required for repository/runtime development workflows. If missing, install through the official Git distribution or a trusted OS/package-manager route and verify `git --version`.

### tunnel-client

Use only the official OpenAI tunnel-client distribution/source.

Current official entry points include:

```text
Platform Tunnels management/download
https://platform.openai.com/settings/organization/tunnels

Latest public release
https://github.com/openai/tunnel-client/releases/latest

Public source
https://github.com/openai/tunnel-client
```

On Windows, select the architecture-matching official release artifact or build from the official source checkout. Validate the release checksum/provenance material when practical. Do not download similarly named executables from unofficial mirrors.

After installation:

```text
tunnel-client --version
tunnel-client help quickstart
tunnel-client runtimes connect --help
tunnel-client runtimes status --help
```

The installed binary's current help outranks version-specific examples in this repository.

## 4. Build a standalone local MCP runtime

The public repository contains one canonical runtime builder:

```text
node templates/gpt-pc-bridge/build-runtime.mjs <target-directory>
```

Choose a user-local application/runtime directory outside the public repo. A typical Windows location is under `%LOCALAPPDATA%`.

The builder copies only the required runtime pieces and rewrites the repository-relative orchestration import so the generated runtime is self-contained.

Then inside the generated target:

```text
npm ci --ignore-scripts
npm run check
```

Do not place OpenAI keys or private deployment state inside the public Git checkout.

## 5. Create/load deployment identity

If an existing local deployment-state file exists, load it and verify its exact remote Tunnel metadata before reuse.

Otherwise generate a fresh deployment UUID using the public helper:

```text
references/gpt-pc-bridge/deployment-identity.mjs
```

Default production identity:

```text
Remote Tunnel: ILYNTO GPT-PC Bridge - <device-label>
Local alias:   ilynto-gpt-pc-bridge-<device-slug>
```

Persist the local non-secret deployment state in the generated user-local deployment area. Never commit the real deployment-state file.

## 6. Verify the local MCP before account work

Prove locally:

- MCP initialize succeeds;
- expected tools are discovered;
- `system.status` works;
- scratch write/read/delete works;
- `semantic.batch(change_verify)` works;
- secret-path and protected-control-root behavior works.

Do not troubleshoot OpenAI Tunnel/account configuration until local MCP is valid.

## 7. Resolve OpenAI Human Boundaries

Required account-side capabilities may include:

- a runtime API key whose principal has Tunnels Read + Use;
- correct organization/workspace scope;
- Admin API key / Tunnels Manage only when remote Tunnel creation/CRUD requires it;
- OpenAI login/MFA/approval;
- ChatGPT-side binding/connector UI interaction when the product requires it.

Keep the runtime key and Admin key separate. Never print/store the raw key in Git or ordinary logs.

## 8. Provision/connect the Tunnel

Follow [`tunnel-provisioning.md`](tunnel-provisioning.md).

Key rule:

> Do not reuse a Tunnel merely because the same OpenAI account/workspace already contains one.

Reuse only when exact same-deployment ownership is verified from local deployment state + current provider metadata.

For a new deployment, use the production display name/description and prefer the current provider-owned `tunnel-client runtimes connect` lifecycle for the stdio MCP runtime when supported.

The stdio shortest path binds the MCP command to `channel=main` in the currently observed official client.

## 9. Verify managed runtime readiness

After connect, inspect the current status for the exact local alias and require provider-equivalent evidence of:

```text
process_running = true
healthy = true
ready = true
```

A create/connect command returning zero is not completion.

If a new remote Tunnel is still propagating, wait/recheck the same Tunnel. Do not create duplicates merely because readiness is delayed.

## 10. Bind ChatGPT

Only after the managed runtime is ready:

- open the account's supported ChatGPT connector/Plugin/App binding surface;
- choose Tunnel connection;
- select the exact newly provisioned/verified Tunnel (or use its explicit Tunnel ID where supported);
- select/use the expected `main` Channel;
- enable only the permissions the user intends.

Treat account UI interaction as a Human Boundary when it cannot be safely automated.

## 11. End-to-end acceptance

From normal ChatGPT through the new binding:

1. call `system.status`;
2. perform a harmless read;
3. create one uniquely named scratch file;
4. read/verify exact content/hash;
5. delete it;
6. verify deletion;
7. confirm no secret value was surfaced;
8. verify persistent runtime/restart behavior if persistent use is required.

Only then return `COMPLETE_VERIFIED`.

## 12. Final receipt

Return a compact non-secret receipt containing at least:

```yaml
state: COMPLETE_VERIFIED
device_label: <label>
local_alias: <alias>
tunnel_name: <display name>
tunnel_id: <id>
channel: main
local_mcp_tools_discovered: true
runtime_process_running: true
runtime_healthy: true
runtime_ready: true
chatgpt_read_e2e: true
chatgpt_write_verify_cleanup_e2e: true
unobserved: []
```

If a required field was not actually observed, put it under `unobserved` instead of claiming success.
