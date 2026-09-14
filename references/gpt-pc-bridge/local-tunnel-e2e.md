# GPT-PC Bridge Local Tunnel E2E Evidence

Status: **PROVEN for local tunnel-client + stdio MCP integration**

Observed: **2026-09-15**

This evidence validates the portable GPT-PC Bridge template through the official OpenAI `tunnel-client` without touching the maintainer's production tunnel or OpenAI account resources.

## Components under test

- Windows x64
- Node.js runtime
- public template: `templates/gpt-pc-bridge/mcp/server.mjs`
- public orchestration engine: `references/orchestration/semantic-batch.mjs`
- official `tunnel-client 0.0.14+0f870e50a973fa820d4c409000059e181e8d242b`
- `tunnel-client dev proxy` local in-memory control plane
- stdio MCP child transport

## Test topology

```text
local MCP test client
  -> local tunnel dev-proxy MCP ingress
  -> in-memory tunnel control plane
  -> official tunnel-client runtime
  -> stdio child: node server.mjs
  -> Windows capability dispatcher
```

No hosted tunnel, production profile, runtime API key, Admin API key, or ChatGPT binding was used in this test.

## Command shape

The official client was launched in bounded local-dev mode with the public MCP template as its stdio child, conceptually:

```text
tunnel-client dev proxy
  --duration <bounded>
  --mcp-command "node <public-template>/server.mjs"
  --url-file <temporary-local-file>
  --health-url-file <temporary-local-file>
```

The client produced a loopback-only local MCP ingress and a local readiness endpoint backed by its in-memory Go control plane.

## Evidence

### 1. MCP initialize through tunnel-client

A JSON-RPC `initialize` request sent to the dev-proxy MCP ingress returned HTTP 200 with:

- protocol version accepted;
- server name `ILYNTO GPT-PC Bridge`;
- server version `0.1.0`;
- tool capability advertised.

### 2. Tool discovery through tunnel-client

`tools/list` returned the public template's tool surface, including:

- `system.status`
- `runtime.info`
- filesystem tools
- shell/exec tools
- process tools
- Git tools
- `semantic.batch`

This proves the official tunnel-client could start the stdio MCP child and forward MCP discovery traffic to it.

### 3. Status tool through tunnel-client

`tools/call -> system.status` succeeded through the local tunnel path and reported:

- `transport = stdio`
- `authority = current-user`
- no public MCP listener
- semantic batching enabled
- verification-after-mutation contract enabled

Machine identity fields are intentionally not copied into this public evidence file.

### 4. Semantic mutation + verification through tunnel-client

One `semantic.batch(change_verify)` request performed two nested local operations:

1. create a temporary scratch file;
2. read it back with SHA-256 verification.

Observed receipt:

```yaml
ok: true
semantic_step: change_verify
operations_requested: 2
operations_executed: 2
failed: 0
stopped_early: false
outer_call_compression:
  semantic_outer_calls: 1
  nested_local_operations: 2
quality_contract:
  semantic_boundary_preserved: true
  fail_fast: true
  verify_required_after_mutation: true
  security_boundary_bypassed: false
```

The verified content matched exactly and SHA-256 evidence was returned. The temporary artifact was removed after the test.

## What this proves

This test proves the following public components are interoperable:

```text
official tunnel-client
+ local in-memory tunnel/control-plane path
+ stdio MCP child supervision
+ public GPT-PC Bridge MCP template
+ public semantic batching engine
+ Windows local read/write execution
```

It also proves that the clean-install stdio topology is not merely a theoretical simplification of the maintainer's existing HTTP deployment.

## What this does NOT yet prove

The overall public recipe remains `PARTIALLY_PROVEN` because this test does not prove:

- hosted OpenAI Secure MCP Tunnel account provisioning on an unrelated user account;
- runtime/admin API-key setup on an unrelated environment;
- ChatGPT-side Plugin/App/Channel creation on an unrelated account;
- restart/logon persistence on a clean unrelated Windows PC;
- end-to-end ChatGPT -> hosted tunnel -> clean PC read/write from the public recipe alone.

Those remain the clean-room promotion gates documented in `recipes/gpt-pc-bridge/verify.md`.

## Reproducibility principle

Future local tunnel integration tests should use the official client's own `dev proxy` mode when available instead of inventing a fake transport harness. This keeps the public test close to provider behavior while avoiding production/account mutation.
