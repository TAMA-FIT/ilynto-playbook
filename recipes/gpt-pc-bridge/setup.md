# GPT-PC Bridge — Setup Contract

Status: **PARTIALLY_PROVEN**

This is a provisioning contract for an AI agent. It is deliberately environment-aware rather than a brittle copy/paste installer.

## Phase 0 — Observe before changing

Collect, preferably in one aggregate read:

- Windows edition/version/architecture;
- current user and elevation state (metadata only; do not expose credentials);
- Node.js/npm availability/version;
- Python availability if the selected MCP implementation needs it;
- Git availability/version;
- current `tunnel-client` availability/version/path;
- whether an existing localhost MCP already provides the required capabilities;
- whether an existing tunnel profile/runtime can be safely reused;
- local port availability;
- current startup/supervision mechanism if one already exists.

Do not reinstall functioning dependencies simply because the recipe mentions them.

## Phase 1 — Choose the shortest implementation path

Preferred order:

1. Reuse an already-working compatible local MCP.
2. Reuse a tested ILYNTO public MCP template/reference implementation.
3. Use another mature trusted MCP that provides the required bounded capability surface.
4. Generate a thin local MCP from the public contracts in this repository.

Reject any route that requires exposing an unauthenticated MCP listener directly to the public Internet when Secure MCP Tunnel is available.

## Phase 2 — Build/configure local MCP

Transport selection:

- for a clean install, prefer a local **stdio MCP command** when the installed tunnel-client still documents it as the shortest supported path;
- if HTTP is required, bind only to `127.0.0.1`, never `0.0.0.0`, provide the current MCP endpoint and a cheap health endpoint, and apply localhost host/origin validation when supported;
- do not add a second MCP supervisor when the selected tunnel-client stdio runtime already owns the child process lifecycle.

Requirements:
- expose a bounded tool schema rather than an opaque single "do anything" string whenever practical;
- keep shell/process execution under the normal current user by default;
- set explicit timeout/output bounds;
- support safe output redirection for large results where useful;
- protect secrets/persistence/trust locations from ordinary generic file access;
- preserve an exceptional Human Boundary for admin/security/persistence expansion.

Recommended base tools are listed in the recipe manifest/README.

### Recommended write fencing

File writes/deletes/moves/copies should support an optimistic hash when replacing an existing object:

```text
read -> obtain sha256 -> write(expectedSha256=observed) -> verify new state
```

Git commits should support an expected HEAD when stale concurrent changes matter.

## Phase 3 — Local MCP verification before tunnel work

Do not debug account/tunnel configuration until the local MCP itself is valid.

Verify:

1. the stdio command starts and completes MCP tool discovery, or the HTTP variant health endpoint responds locally;
2. expected tool names/schemas are visible;
3. harmless filesystem read works;
4. temporary bounded write/read/delete works in a scratch directory;
5. shell command such as runtime/version inspection works;
6. output/time bounds behave as expected;
7. protected secret/system locations do not become silently exposed through a generic helper path.

## Phase 4 — Inspect current tunnel-client contract

Before constructing commands, run the installed binary's current help, for example:

```text
tunnel-client --version
tunnel-client help quickstart
tunnel-client runtimes connect --help
tunnel-client runtimes status --help
```

If tunnel CRUD is needed and supported:

```text
tunnel-client admin tunnels create --help
tunnel-client admin tunnels list --help
```

Do not assume the flags documented from the maintainer's observed `0.0.14` remain identical forever.

## Phase 5 — Resolve Human Boundary for account credentials

The agent should explain exactly which account-side artifact is missing.

Possible required artifacts:

- tunnel resource / Tunnel ID;
- runtime API key with tunnel Read + Use permission;
- admin API key only if CLI tunnel CRUD is intentionally used;
- organization/workspace scope needed for tunnel creation.

The agent may open or point the user to supported provider surfaces, but must not claim account authentication or key creation succeeded without actual evidence.

### Key separation

Keep:

```text
runtime key -> long-lived tunnel daemon
admin key   -> tunnel CRUD only
```

Never reuse the admin key as the daemon credential merely for convenience.

## Phase 6 — Create/reuse tunnel and Channel

Prefer reuse when an existing intended tunnel is healthy and correctly scoped.

When creation is needed, use the current supported provider UI/CLI. With the observed tunnel-client version, admin creation requires:

- a real Admin API key;
- name;
- description;
- at least one organization or workspace attachment.

The observed CLI also warns that a newly created tunnel may need roughly 25–30 seconds before it is active/ready. Treat this as version-specific operational guidance, not a timeless SLA.

For the observed official client, the shortest stdio sample maps the command to `channel=main`:

```yaml
mcp:
  commands:
    - channel: main
      command: "node C:/path/to/server.mjs"
```

The proven loopback HTTP alternative is:

```yaml
mcp:
  server_urls:
    - channel: main
      url: "http://127.0.0.1:<mcp-port>/mcp"
```

Use a stable, simple channel name unless multiple distinct MCP endpoints are intentionally exposed.

## Phase 7 — Store runtime credential safely

Do not place a plaintext API key in:

- the repository;
- committed YAML;
- command-line history when avoidable;
- ordinary logs;
- canonical project memory.

Supported options depend on the environment. Prefer, in order:

1. provider-supported key reference (`env:NAME`, `file:/protected/path`, or current equivalent);
2. OS credential/secret protection;
3. a user-scoped protected configuration file with restrictive ACLs.

On Windows, an implementation may use DPAPI/SecureString or another OS-protected mechanism, but the recipe does not require the maintainer's exact private implementation.

## Phase 8 — Long-lived supervision

With the observed official client, the preferred Codex-managed route is:

```text
tunnel-client runtimes connect ...
```

rather than `nohup`/`disown`-style ad-hoc supervision.

When the stdio path is selected, `runtimes connect --mcp-command ...` can keep the tunnel runtime and MCP child under one supported lifecycle.

After connect, always query:

```text
tunnel-client runtimes status <alias> --json
```

Do not report tunnel setup complete unless current status proves the managed runtime is running and healthy/ready using the fields exposed by the installed version.

If the environment instead intentionally uses foreground operation:

```text
tunnel-client run --profile <profile>
```

keep that distinction explicit.

## Phase 9 — ChatGPT-side binding

Only after tunnel runtime readiness is proven:

1. open ChatGPT's supported Plugin/connector creation surface;
2. create the binding/Plugin;
3. give it a clear local name;
4. select the Channel generated by the tunnel configuration;
5. save/enable it with the permissions the user intends.

On the maintainer's current UI this is only a few interactions (name + Channel selection + creation), but UI wording is not part of the durable recipe.

This remains a Human Boundary when the platform requires interactive account UI.

## Phase 10 — End-to-end acceptance

From an ordinary ChatGPT conversation using the new binding:

1. call `system.status` or equivalent harmless status tool through ChatGPT;
2. read a known non-sensitive scratch file;
3. create a uniquely named temporary scratch file using a bounded/fenced write;
4. read it back and verify exact content/hash;
5. delete the temporary file;
6. verify deletion;
7. if Git capability is intended, run read-only `git.status` in a harmless test repo;
8. confirm no runtime/admin key appeared in output/logs/repository.

Only then mark `COMPLETE_VERIFIED`.

## Phase 11 — Apply fast orchestration

After connectivity works, do not leave the bridge as a serial primitive tool collection.

Add/adopt the ILYNTO fast verified orchestration pattern:

- aggregate state acquisition;
- semantic DAG batching;
- safe read parallelism;
- verify-after-mutation contract;
- compact evidence;
- outer-call telemetry;
- DIRECT/GUARD/MANAGED separation as needed.

Connectivity first, orchestration second, but both are part of the final quality target.

## Idempotency / rerun behavior

A provisioning agent must be safe to rerun.

On rerun:

- detect existing MCP files/config/version;
- detect existing tunnel profile/runtime;
- verify rather than duplicate working resources;
- repair only broken/missing components;
- preserve user customizations unless incompatible with the security contract;
- never create a second tunnel simply because the first call already succeeded but readiness was delayed;
- never rotate/revoke credentials unless the user requests it or compromise is suspected.
