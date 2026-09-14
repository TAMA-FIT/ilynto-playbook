# GPT-PC Bridge for Windows

Status: **PARTIALLY_PROVEN**

This recipe describes how to give ChatGPT a Codex-like local execution surface on a user-owned Windows PC by connecting a local MCP server through **OpenAI Secure MCP Tunnel**. For a clean install, the current official tunnel-client makes a local stdio MCP command the shortest path; a loopback HTTP MCP remains a proven alternative.

The architecture itself is proven in a live deployment. The public recipe is marked `PARTIALLY_PROVEN` until it has also been reproduced from scratch on an unrelated clean Windows environment using only this repository.

## Start here

For an AI/Codex clean bootstrap, start with [`bootstrap.md`](bootstrap.md). It routes prerequisite discovery, standalone runtime generation, Tunnel provisioning, Human Boundaries, and final acceptance.

## Target user experience

The eventual goal is intentionally simple:

```text
Open Codex once
  -> tell it to follow this recipe
  -> Codex inspects the PC
  -> installs/builds the smallest local MCP runtime needed
  -> prefers stdio MCP for the clean-install path when current tunnel-client supports it
  -> configures OpenAI Secure MCP Tunnel
  -> verifies process/health/readiness
  -> tells the user the remaining ChatGPT-side binding step

Then normal use becomes:

ChatGPT
  -> Plugin / equivalent binding
  -> selected tunnel Channel
  -> OpenAI Secure MCP Tunnel
  -> local MCP
  -> Windows filesystem / shell / process / Git / runtime
```

ILYNTO is not in the runtime data path. This repository is only the instructions/reference source.

## Why this is different from installing a remote-control agent

With the preferred clean-install stdio path, the MCP server has **no network listener at all**: tunnel-client launches the local MCP command and carries its MCP traffic over the outbound OpenAI tunnel. The already-proven alternative is an HTTP MCP bound only to loopback (`127.0.0.1`). In neither design is the MCP directly published to the Internet.

A good implementation also keeps:

- ordinary execution under the current Windows user rather than Administrator;
- secrets out of MCP tool arguments and Git;
- an explicit Human Boundary for UAC/admin/security changes;
- local security/path rules for credential and persistence locations;
- post-mutation verification;
- source/hash/Git fences where stale writes matter;
- no automatic switch to a different authority/transport path when something fails.

## Proven reference architecture

```text
+---------------------------+
| ChatGPT                   |
|  Plugin / binding         |
+-------------+-------------+
              |
              | OpenAI control plane
              v
+---------------------------+
| OpenAI Secure MCP Tunnel  |
+-------------+-------------+
              |
              | outbound tunnel terminates locally
              v
+---------------------------+
| tunnel-client             |
| managed local runtime     |
+-------------+-------------+
              |
              | preferred: stdio child / alternative: loopback HTTP
              v
+---------------------------+
| Local MCP Server          |
| stdio or 127.0.0.1 only   |
+-------------+-------------+
              |
              v
+---------------------------+
| Windows capabilities      |
| fs / shell / process/git  |
+---------------------------+
```

## Official tunnel-client behavior observed during extraction

The installed official `tunnel-client` used for this recipe reported version:

```text
0.0.14+0f870e50a973fa820d4c409000059e181e8d242b
```

Its built-in quickstart states that:

- it is the supported path for connecting local/private MCP servers to ChatGPT/OpenAI rather than an ad-hoc public tunnel;
- it connects the local/private MCP server to the OpenAI control plane over an outbound tunnel;
- its built-in `sample_mcp_stdio_local` describes local stdio MCP as the shortest first-use path and binds the command to `channel=main`;
- it exposes local `/healthz`, `/readyz`, and `/ui` operator endpoints;
- `tunnel-client run` is appropriate for an intentional foreground daemon;
- for a long-lived local runtime managed by Codex, prefer `tunnel-client runtimes connect`;
- after connect, `tunnel-client runtimes status <alias>` must be checked before reporting success;
- JSON status can expose `process_running`, `healthy`, and `ready` fields;
- an Admin API key is for tunnel CRUD and should **not** be given to the long-lived daemon;
- the runtime API key is the credential used by the daemon for doctor/run/runtime operation.

Treat these commands as versioned provider behavior: a provisioning agent should read the installed binary's current help before assuming flags remain identical. The maintained provider-reference entry point is [`official-sources.md`](official-sources.md).

## Minimal local MCP surface

A general-purpose Windows bridge should expose enough capability to perform real development/automation work without requiring a new custom tool for every task.

Recommended base surface:

### Read

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

### Mutate / execute

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

### Strongly recommended orchestration extensions

```text
aggregate state/resume
semantic batch
source/hash/Git fences
outer-call telemetry
protected secret paths
exceptional command boundary
```

The exact tool names do not matter. The contracts and safety properties do.

## Orchestration

Do not expose 20 tools and then make the model call them serially forever.

Apply [`../../patterns/orchestration/`](../../patterns/orchestration/README.md):

```text
Fresh/aggregate decision material
  -> DIRECT semantic batch
  -> local deterministic operations
  -> focused verification
  -> compact evidence
```

For normal development, aim for one or two semantic epochs instead of one model-visible call per file/command/test.

## Account-side values

There are three distinct concepts that must not be conflated:

### Tunnel ID

Identifies the OpenAI tunnel resource. It can be created/inspected through the provider's tunnel management surface or through supported tunnel-client admin commands when the user has appropriate administrative credentials.

### Runtime API key

Used by the long-lived tunnel client runtime. It should be stored through an environment reference or OS-protected secret mechanism, not committed to a profile or repository.

### Admin API key

Used only when tunnel CRUD is required through the admin CLI. Do not place it in the long-lived daemon environment unless provider documentation explicitly changes this model.

## Channel

A tunnel profile maps one or more named channels to an MCP server URL or local stdio command. The shortest observed stdio form conceptually looks like:

```yaml
mcp:
  commands:
    - channel: main
      command: "node C:/path/to/server.mjs"
```

The proven loopback HTTP alternative looks like:

```yaml
mcp:
  server_urls:
    - channel: main
      url: "http://127.0.0.1:<mcp-port>/mcp"
```

The user's ChatGPT-side Plugin/binding can then select the exposed Channel. UI labels may change over time, so do not automate against screenshots when a supported provider interface is available.

## What Codex should automate

A provisioning agent following this recipe should attempt to automate:

1. inspect OS/runtime/Git/Node/Python state;
2. determine whether an appropriate MCP runtime already exists;
3. prefer a tested ILYNTO template/reference over generating an unrelated implementation from scratch;
4. install only missing dependencies;
5. generate/configure the local MCP server;
6. prefer stdio for a clean install when supported; otherwise bind HTTP only to loopback;
7. test local MCP discovery and a harmless scratch round-trip (plus HTTP health when using the loopback HTTP variant);
8. inspect the current `tunnel-client` binary help;
9. provision the Tunnel through supported OpenAI paths using the production identity policy; reuse only when exact same-deployment ownership is proven;
10. configure `channel=main` for the selected local MCP binding (stdio command preferred; loopback URL for the HTTP alternative);
11. configure runtime credential reference without committing plaintext secrets;
12. use supported long-lived supervision (`runtimes connect` when available/currently recommended);
13. check runtime status and require running + healthy + ready;
14. perform a harmless MCP read test;
15. leave the user only the irreducible ChatGPT-side binding/account-auth steps;
16. after binding, perform one harmless end-to-end read and one bounded write/verify test.

## What Codex must not silently automate

Do not bypass or fake:

- OpenAI login/MFA/account consent;
- creation of privileged/admin credentials without the authorized user's action/consent;
- Windows UAC/admin elevation;
- weakening Defender/firewall/security policy merely to make setup easier;
- publishing the local MCP directly to the Internet as a substitute for the supported tunnel;
- copying secrets into Git, prompts, logs, or README files;
- destructive system-wide persistence when ordinary user startup/supervision is sufficient.

## Clean-room acceptance criteria

This recipe becomes `PROVEN` as a public recipe only after an unrelated Windows environment can complete the following from the public repository alone:

- discover/install the needed local runtime;
- launch the local MCP through the selected supported transport;
- enumerate expected tools;
- establish Secure MCP Tunnel;
- expose the intended Channel;
- survive a restart/logon using the selected supervision design;
- show runtime `process_running`, `healthy`, and `ready` (or provider-equivalent current fields);
- connect from ChatGPT using the account's normal supported UI;
- execute a harmless read from ChatGPT;
- create a temporary file from ChatGPT using a fenced/bounded write;
- read/verify it;
- remove the temporary artifact;
- leave no plaintext credentials in repository, command line, or ordinary logs.

The strongest public evidence available before that final clean-room promotion is [`../../references/gpt-pc-bridge/local-tunnel-e2e.md`](../../references/gpt-pc-bridge/local-tunnel-e2e.md): the official `tunnel-client` local dev control plane successfully supervised the public stdio MCP template and carried MCP initialize, tool discovery, status, and a semantic write+verify+cleanup round trip without using production credentials or a hosted tunnel.

## Files in this recipe

- [`bootstrap.md`](bootstrap.md) — shortest operational entry point for Codex/AI provisioning
- [`setup.md`](setup.md) — environment-neutral provisioning sequence
- [`security.md`](security.md) — threat/safety boundary
- [`verify.md`](verify.md) — completion and clean-room acceptance gates
- [`troubleshooting.md`](troubleshooting.md) — failure classification without hidden fallback
- [`official-sources.md`](official-sources.md) — current provider source entry points and availability caveats
- [`tunnel-provisioning.md`](tunnel-provisioning.md) — production Tunnel naming, creation, reuse, ownership, and cleanup contract
- [`manifest.yaml`](manifest.yaml) — machine-readable recipe summary

The tested portable stdio MCP template is [`../../templates/gpt-pc-bridge/mcp/`](../../templates/gpt-pc-bridge/mcp/README.md). [`../../templates/gpt-pc-bridge/build-runtime.mjs`](../../templates/gpt-pc-bridge/build-runtime.mjs) produces a standalone runtime outside the public repo. Tunnel profile reference material is under [`../../templates/gpt-pc-bridge/tunnel/`](../../templates/gpt-pc-bridge/tunnel/README.md). The repository keeps the generic orchestration engine in one place under `references/orchestration/` rather than duplicating it inside the template.
