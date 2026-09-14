# GPT-PC Bridge MCP Template

Status: **LOCAL E2E PROVEN / TUNNEL CLEAN-ROOM PENDING**

This template is the smallest reusable local execution surface for the GPT-PC Bridge recipe. It is intentionally a **stdio MCP server** so the official OpenAI `tunnel-client` can launch and supervise it directly for the shortest clean-install path.

It is not the maintainer's private ILYNTO runtime. It is a sanitized, portable implementation built from the public ILYNTO capability/orchestration contracts.

## What it exposes

Read-oriented tools:

```text
system.status
runtime.info
fs.stat
fs.list
fs.read
fs.search
process.list
git.status
git.diff
```

Mutation/execution tools:

```text
fs.write
fs.mkdir
fs.delete
fs.move
fs.copy
shell.run
exec.run
process.start
process.stop
git.stage
git.commit
git.remote
```

Orchestration:

```text
semantic.batch
```

`semantic.batch` reuses the single public implementation in [`../../../references/orchestration/semantic-batch.mjs`](../../../references/orchestration/semantic-batch.mjs). The repository intentionally does not keep a second copy of that engine inside this template.

## Local prerequisites

- Windows
- Node.js 20+
- npm
- Git
- Windows PowerShell

Install dependencies:

```powershell
npm ci --ignore-scripts
```

Syntax check:

```powershell
npm run check
```

The server communicates over stdin/stdout. Do not print ordinary logs to stdout. Diagnostics belong on stderr because stdout is the MCP protocol stream.

## Preferred tunnel topology

```text
ChatGPT
  -> custom Plugin/App/binding
  -> Secure MCP Tunnel channel=main
  -> tunnel-client managed runtime
  -> node server.mjs  (stdio)
  -> Windows capabilities
```

The current official `tunnel-client` documents its local stdio sample as the shortest first-use path and binds the command to `channel=main`.

A provisioning agent should inspect the installed binary's current help before constructing the final command:

```powershell
tunnel-client --version
tunnel-client help quickstart
tunnel-client profiles samples show sample_mcp_stdio_local
tunnel-client runtimes connect --help
tunnel-client runtimes status --help
```

Conceptually, a long-lived managed setup uses:

```text
tunnel-client runtimes connect
  --alias <local-alias>
  --profile <profile-name>
  --tunnel-id <user-owned-tunnel-id>
  --runtime-api-key env:CONTROL_PLANE_API_KEY
  --mcp-command "node <absolute-path-to-server.mjs>"
```

Exact flags are provider/versioned behavior. Treat the installed binary as the current authority.

After connect, require current status evidence equivalent to:

```text
process_running = true
healthy = true
ready = true
```

Do not report setup complete merely because the launch command returned successfully.

## Runtime API key vs Admin API key

Keep these separate:

```text
Runtime API key
  -> long-lived tunnel runtime
  -> Tunnel Read + Use

Admin API key
  -> tunnel CRUD only when needed
  -> never give to the long-lived daemon
```

Do not commit either key or put plaintext keys into this template.

## Security defaults in this template

The template intentionally runs with the current Windows user's authority, not Administrator by default.

It also applies defense-in-depth restrictions to generic tools:

- common credential/secret paths and filenames are denied to generic file access;
- generic writes to selected persistence/trust locations are denied;
- self-modification of this MCP runtime through generic file tools is denied;
- selected exceptional system/security/persistence shell commands are denied and should become a Human Boundary;
- file replacement/deletion can use SHA-256 stale-state fences;
- Git commit can use an expected-HEAD fence;
- command duration and returned output are bounded.

These checks are **not a cryptographic sandbox**. Generic current-user shell remains powerful. If a deployment requires hard isolation, use OS/container/sandbox boundaries or remove generic shell/exec capability.

See [`../../../recipes/gpt-pc-bridge/security.md`](../../../recipes/gpt-pc-bridge/security.md).

## Fast orchestration

The server advertises `semantic.batch` so ChatGPT does not need one remote tool call per local primitive.

A typical development flow is:

```text
semantic.batch(inspect)
  -> parallel bounded reads/search/Git state

semantic.batch(change_verify)
  -> write/edit/command
  -> focused verification
  -> compact evidence
```

The batch engine enforces:

- DAG dependencies;
- result references;
- safe automatic read parallelism;
- fail-fast behavior;
- mutation/finalization followed by verification;
- compact output and outer-call-compression evidence.

See [`../../../patterns/orchestration/`](../../../patterns/orchestration/README.md).

## Tests already performed

The repository's automated test spawns this exact stdio server as a child process and speaks MCP JSON-RPC over its real stdin/stdout.

Current local acceptance covers:

- MCP initialize;
- `tools/list` discovery;
- `system.status` call;
- `semantic.batch` scratch file create + read/verify;
- SHA-256 evidence;
- scratch cleanup;
- secret-shaped file denial;
- self-runtime generic-write denial.

The current recipe remains `PARTIALLY_PROVEN` until a separate Windows machine reproduces the full sequence including Secure MCP Tunnel, ChatGPT channel binding, restart/logon persistence, and end-to-end ChatGPT read/write verification using only the public repository.

## Provisioning note for Codex

Because this template imports the public orchestration engine from elsewhere in the repository, Codex should not blindly download `server.mjs` alone. It should either:

1. work from a repository checkout; or
2. copy `server.mjs` plus the referenced `semantic-batch.mjs` into its generated runtime and update the import path accordingly.

That keeps one source of truth in this repository while still allowing generated runtimes to be self-contained.
