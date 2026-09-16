# GPT-PC Bridge 窶・Troubleshooting Without Hidden Fallback

Status: **PARTIALLY_PROVEN**

Diagnose by layer. Do not react to a failed layer by silently switching to a different transport, authority model, or public-tunnel workaround.

## Failure map

```text
ChatGPT cannot call tool
   |
   +--> Binding/Channel visible?
   |      no -> ChatGPT/account-side binding layer
   |
   +--> Tunnel ready?
   |      no -> tunnel/runtime/control-plane layer
   |
   +--> Local MCP healthy?
   |      no -> local MCP/process/dependency layer
   |
   +--> Tool discovered?
   |      no -> MCP schema/registration layer
   |
   +--> Tool runs locally but remote mutation denied?
          -> transport attestation / security / authority layer
```

Start at the closest failed invariant rather than reinstalling everything.

## 1. Local MCP health fails

Check:

- process actually running;
- selected port is free;
- server bound to expected loopback address;
- Node/Python dependencies installed;
- startup stderr/log;
- syntax/import/version mismatch;
- health route itself;
- framework version compatibility.

Do not touch tunnel/account configuration until local MCP health is restored.

## 2. Health works but MCP tool discovery fails

Check:

- `/mcp` path is correct;
- MCP handler is attached to that route;
- framework transport/response mode matches current client expectations;
- host/origin validation is not rejecting legitimate loopback requests;
- tool schemas parse;
- server startup did not skip registration after a partial error.

Use a local MCP client/diagnostic before involving the tunnel.

## 3. Local tools work but `doctor` fails

Classify the failure:

- missing runtime API key reference;
- runtime key lacks tunnel Read + Use permission;
- tunnel ID does not exist or is outside accessible org/workspace scope;
- control-plane URL/config mismatch;
- outbound TLS/proxy/private-CA issue;
- profile malformed;
- local MCP URL unreachable from tunnel-client process.

Do not place an admin key into the daemon just to make a runtime-key error disappear.

## 4. Tunnel was just created but is not ready

The observed `tunnel-client 0.0.14` admin help warns that new tunnel creation may need roughly 25窶・0 seconds before becoming active/ready.

Therefore:

- wait using a bounded provider/runtime readiness check;
- query the same tunnel again;
- do **not** create a second tunnel immediately;
- if readiness remains absent beyond a reasonable bounded window, inspect status/doctor evidence.

Treat the exact activation delay as version-specific.

## 5. `runtimes connect` returned but status is not ready

A launch result is not completion.

Run current equivalent of:

```text
tunnel-client runtimes status <alias> --json
```

Inspect separately:

- process running;
- healthy;
- ready.

If process is not running, inspect runtime supervision/logs.
If process is running but unhealthy, inspect profile/local MCP.
If healthy but not ready, inspect control-plane/tunnel/channel readiness.

## 6. Tunnel does not appear in ChatGPT

Current official ChatGPT connector guidance is Tunnel-centric. Before changing ChatGPT configuration, confirm:

- tunnel runtime is running/healthy/ready;
- the Tunnel has the correct organization/workspace scope;
- the connector operator has the required Tunnel Read + Use authority;
- the Tunnel is not still within normal control-plane propagation delay;
- active profile contains the expected local `main` channel mapping;
- profile points to the correct local MCP command/port/path.

Then refresh/reopen the supported binding surface and select the exact Tunnel or paste its Tunnel ID. If the current UI explicitly exposes a Channel selector, use `main`; otherwise no separate Channel action is required.

## 7. Tunnel is bound but tools are missing

Likely layers:

- `main` is mapped to the wrong MCP;
- local MCP tool registration changed;
- stale binding/plugin metadata;
- MCP server booted partially;
- schema/tool registration error.

Compare local discovery output with the tool surface visible through ChatGPT.

Do not infer success merely because the Tunnel or Channel label is correct.

## 8. Reads work but mutations fail

This can be expected security behavior.

Inspect:

- current-user filesystem permission;
- source/hash/Git fence mismatch;
- protected path policy;
- remote request attestation/security check;
- exceptional Human Boundary classification;
- UAC/admin requirement;
- Git credentials/branch protection for remote actions.

Do not disable security controls globally until the exact boundary is understood.

## 9. Shell works locally but not through ChatGPT

Check whether the remote execution path intentionally classifies the command as exceptional.

Examples that may require a Human Boundary in a hardened deployment:

- scheduled-task mutation;
- service mutation;
- firewall/Defender changes;
- registry mutation;
- shell persistence mechanisms;
- dangerous Git config hooks/credential helpers;
- credential dumping/access;
- download-to-interpreter pipelines;
- shutdown/restart.

A harmless read form (for example querying an existing task) may remain allowed while mutation is denied.

## 10. MCP/tunnel stops after logout/restart

Separate two components:

1. local MCP supervision;
2. tunnel-client supervision.

Use the supported current tunnel-client managed runtime path when available. For local MCP, choose a user-scoped supported startup mechanism appropriate to the environment.

On Windows this might be a user Scheduled Task or another user service/supervisor, but do not require Administrator if ordinary current-user persistence is enough.

After changing persistence, rerun restart/logon verification rather than assuming it works.

## 11. Codex can build it but ChatGPT cannot use it

This means the local build path and ChatGPT binding path are different layers.

Verify in order:

```text
local MCP
-> tunnel-client ready
-> channel mapping
-> ChatGPT binding
-> ChatGPT tool discovery
-> E2E read
```

Do not rebuild the MCP if local discovery is already correct.

## 12. Credential leakage suspected

Stop treating this as ordinary troubleshooting.

Actions:

1. stop/disable the affected runtime if needed;
2. identify which credential may have leaked;
3. rotate/revoke through the provider's supported account interface;
4. remove plaintext copies from files/logs/history where feasible;
5. inspect Git history if anything may have been committed;
6. repair secret storage;
7. re-run secret scan;
8. reconnect with a new least-privilege runtime credential.

Do not simply delete the visible file and assume the secret is safe.

## 13. Local security/control files were modified unexpectedly

Treat as integrity drift.

Do not silently auto-repair a trust root from an unverified source.

Compare against a known-good package/commit/hash, determine whether the change is authorized, then either:

- promote/record the intentional version; or
- restore a verified known-good version and investigate.

## 14. Performance is poor despite connectivity

Measure orchestration, not only network latency.

Look for:

- model-visible one-call-per-file behavior;
- repeated `git status`/health/process polls;
- one transport RPC per local execution step;
- full regression on every micro-change;
- huge raw output returned to model;
- GUARD/MANAGED being used for every normal operation;
- no safe parallelism for independent reads.

Then apply [`../../patterns/orchestration/`](../../patterns/orchestration/README.md).

## Recovery principle

The default recovery state is explicit `REPLAN`, not hidden fallback.

A useful failure receipt contains:

```yaml
state: REPLAN
failed_layer: tunnel_runtime
reason: runtime_not_ready
observed:
  process_running: true
  healthy: true
  ready: false
mutation_performed: false
suggested_next_check: control_plane_readiness
```

That gives the agent enough information to fix the right layer without changing the trust model behind the user's back.
