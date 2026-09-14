# GPT-PC Bridge — Verification Gates

Status: **PARTIALLY_PROVEN**

Do not report setup complete because files were created or a tunnel command returned zero. Completion requires evidence at every layer.

## Gate A — Local MCP

Required:

- selected MCP command/server starts successfully;
- stdio is preferred for the clean-install template; if HTTP is used, its listener is bound only to loopback;
- HTTP health endpoint returns success when the HTTP variant is selected;
- MCP tool discovery returns the intended public tool surface;
- tool schemas are valid;
- harmless local read succeeds;
- scratch write/read/delete succeeds;
- shell/runtime probe succeeds;
- output and timeout limits are active.

Suggested evidence receipt:

```json
{
  "localMcp": {
    "transport": "stdio-or-loopback-http",
    "processRunning": true,
    "publicListener": false,
    "health": true,
    "toolDiscovery": true,
    "scratchRoundTrip": true
  }
}
```

## Gate B — Tunnel runtime

Use the installed tunnel-client's current supported status command.

For the observed client version, after `runtimes connect` query:

```text
tunnel-client runtimes status <alias> --json
```

Require the current equivalent of:

- managed process running;
- healthy;
- ready.

If the runtime is launched but not ready, report **not complete** and diagnose. Do not create duplicate tunnels simply because readiness is delayed.

## Gate C — Channel mapping

Confirm the active tunnel profile maps the intended Channel to the intended local MCP binding: the stdio command in the preferred clean-install path, or the loopback MCP URL in the HTTP alternative.

Check:

- correct channel name;
- correct stdio command/path, or correct loopback port/path for the HTTP alternative;
- no stale second profile unintentionally pointing to another MCP;
- no plaintext runtime/admin secret embedded in committed/public profile material.

## Gate D — ChatGPT binding

While the tunnel runtime is healthy/ready:

- create/enable the supported ChatGPT Plugin/connector/binding;
- select the expected Channel;
- confirm the binding exposes the intended MCP tool surface.

Do not treat a visible Channel name alone as proof that the local MCP behind it is healthy.

## Gate E — End-to-end harmless read

From ChatGPT through the actual binding:

1. call a harmless status/runtime tool;
2. confirm the response comes from the expected PC/runtime;
3. inspect a non-sensitive scratch directory/file.

This proves:

```text
ChatGPT -> binding -> tunnel -> tunnel-client -> local MCP -> Windows read
```

## Gate F — End-to-end bounded mutation

Use a unique temporary path under a scratch location, not a production/project file.

1. confirm path does not already exist;
2. create a small text file;
3. read it back;
4. compare exact content and/or SHA-256;
5. delete it;
6. verify it no longer exists.

Expected result:

```text
write verified
read verified
cleanup verified
```

If any postcondition is unobserved, do not report full completion.

## Gate G — Git read path

If Git is part of the exposed capability surface:

- choose a harmless test repository;
- run read-only status/diff;
- verify repository identity/root;
- do not create a commit merely to test Git unless using an isolated disposable repo.

## Gate H — Security smoke

Without exposing a real secret, test representative denial behavior using synthetic protected/scratch fixtures when possible.

Verify:

- stdio MCP has no listener, or the HTTP variant is not listening publicly;
- secret-shaped/configured protected file path is rejected by generic access policy if that policy is implemented;
- exceptional privileged/persistence action does not run silently;
- logs/telemetry do not contain runtime/admin API key values;
- repository `git status` is clean of credentials/generated secret files.

## Gate I — Restart/logon survival

If persistent use is a requirement:

1. restart the managed local runtime or perform the supported supervision restart;
2. verify local MCP health;
3. verify tunnel running/healthy/ready;
4. repeat a harmless ChatGPT read.

A one-session demo is not equivalent to a persistent bridge.

## Gate J — Orchestration quality

After connectivity works, verify the bridge is not forcing primitive serial choreography.

For a representative small development task, collect:

- model-visible outer calls;
- nested local operations;
- semantic batch count;
- wall time;
- verification evidence.

Target behavior should align with the fast verified orchestration pattern: known/read-only work often one semantic epoch; normal unknown development commonly decision-material + change/verify.

## Final completion receipt

A provisioning agent should produce a compact final receipt similar to:

```yaml
state: COMPLETE_VERIFIED
local_mcp:
  healthy: true
  public_listener: false
  tools_discovered: true
tunnel:
  process_running: true
  healthy: true
  ready: true
channel:
  name: main
  mapped_to_expected_mcp: true
chatgpt:
  binding_configured: true
  harmless_read_e2e: true
  bounded_write_verify_cleanup_e2e: true
persistence:
  verified: true
security:
  plaintext_secret_found: false
  direct_public_mcp_listener: false
unobserved: []
```

If any required field cannot be observed, put it under `unobserved` and do not silently convert it to success.

## Clean-room promotion criterion

The public recipe can change from `PARTIALLY_PROVEN` to `PROVEN` when a machine not containing the maintainer's private ILYNTO installation can reproduce Gates A–I using only:

- this public repository;
- current supported OpenAI/tunnel-client distribution/access;
- the user's own account authorization/credentials;
- ordinary prerequisite installers as documented/discovered.

Record OS version, tunnel-client version, runtime versions, final public test commit SHA, and any deviations discovered during that clean-room run.
