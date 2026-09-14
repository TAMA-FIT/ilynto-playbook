# GPT-PC Bridge — Tunnel Provisioning Contract

Status: **PROVIDER PATH PROVEN / CLEAN-ROOM ACCOUNT RUN PENDING**

This document defines how a provisioning agent should create, identify, reuse, and verify the OpenAI Tunnel resource for the GPT-PC Bridge recipe.

The Tunnel is an **OpenAI-side resource**. It is not owned by one Windows installation merely because a particular PC runs `tunnel-client`.

## 1. Prefer the official native lifecycle

Do not reimplement OpenAI tunnel CRUD/protocol logic in ILYNTO.

With a current full `tunnel-client` binary, prefer its native lifecycle surface:

```text
tunnel-client runtimes connect
```

The currently observed official client describes this command as:

```text
Create or reuse a tunnel alias and run a native profile locally
```

It supports:

- local runtime alias;
- remote display name and description;
- organization/workspace scope for lookup/creation;
- explicit existing Tunnel ID when intentionally attaching to one;
- runtime API-key reference;
- local stdio MCP command;
- generated profile;
- managed local runtime supervision.

Therefore the public ILYNTO recipe should define policy around that provider-owned primitive rather than duplicate it with a second custom tunnel manager.

## 2. Production naming policy

Do not create anonymous names such as `test`, `main`, `my-tunnel`, or a raw UUID.

Default remote Tunnel display name:

```text
ILYNTO GPT-PC Bridge - <device-label>
```

Examples:

```text
ILYNTO GPT-PC Bridge - Bayashi Laptop
ILYNTO GPT-PC Bridge - Office Desktop
ILYNTO GPT-PC Bridge - Surface Pro
```

Default local runtime alias:

```text
ilynto-gpt-pc-bridge-<device-slug>
```

Example:

```text
ilynto-gpt-pc-bridge-bayashi-laptop
```

The device label should be human-recognizable. A provisioning agent may use the Windows computer name automatically when it is already meaningful. If it is a generic OEM/random label and another reliable user-facing device label is locally available, prefer the clearer label. Do not block ordinary provisioning solely to ask for cosmetic naming input.

## 3. Description / ownership marker

Human-readable names are not a safe ownership primitive because names can collide.

Every ILYNTO-created Tunnel should also carry a description containing a machine-readable ownership marker:

```text
Created by ILYNTO Playbook for GPT-PC Bridge.
managed-by=ilynto-playbook
recipe=gpt-pc-bridge.windows
deployment=<deployment-uuid>
device=<device-label>
```

The public reference implementation for creating/parsing this identity is:

```text
references/gpt-pc-bridge/deployment-identity.mjs
```

## 4. Deployment identity

Generate one stable random UUID for the local GPT-PC Bridge deployment and persist it with the generated local runtime state.

Recommended persisted fields:

```json
{
  "schemaVersion": 1,
  "recipeId": "gpt-pc-bridge.windows",
  "deploymentId": "<uuid>",
  "deviceLabel": "<human label>",
  "localAlias": "ilynto-gpt-pc-bridge-<slug>",
  "tunnelId": "tunnel_<id>",
  "tunnelName": "ILYNTO GPT-PC Bridge - <device-label>"
}
```

This deployment state is private local operational state. Do not commit it to the public repository.

## 5. Reuse policy

The phrase "Tunnel exists" must **never** mean "the OpenAI account has at least one Tunnel".

Automatic reuse is allowed only when the agent can prove the Tunnel belongs to the same ILYNTO deployment.

Preferred proof:

1. local deployment state contains a previously recorded `tunnelId` and `deploymentId`;
2. current provider metadata for that exact Tunnel ID is fetched;
3. metadata description contains:
   - `managed-by=ilynto-playbook`;
   - `recipe=gpt-pc-bridge.windows`;
   - the exact same `deployment=<deploymentId>`;
4. required organization/workspace scope is still suitable;
5. no conflicting active stdio runtime is using the Tunnel.

Only then may provisioning automatically reuse it.

### Never reuse merely because

- a Tunnel has the same display name;
- a Tunnel belongs to the same OpenAI account;
- a Tunnel exists in the same workspace;
- a local `main` Channel exists;
- the agent finds some other healthy Tunnel.

If ownership cannot be proven, leave the unrelated Tunnel unchanged.

## 6. New Tunnel path

When no verified same-deployment Tunnel exists, create a new ILYNTO GPT-PC Bridge Tunnel through the current supported provider surface.

For a long-lived Codex-managed stdio deployment, the preferred current shape is conceptually:

```text
tunnel-client runtimes connect
  --alias <ilynto-local-alias>
  --organization-id <scope> and/or --workspace-id <scope>
  --name "ILYNTO GPT-PC Bridge - <device-label>"
  --description "<ILYNTO ownership marker>"
  --runtime-api-key env:CONTROL_PLANE_API_KEY
  --mcp-command "node <generated-runtime>/server.mjs"
  --json
```

The current official command owns remote tunnel alias lookup/creation, generated native profile, and managed local runtime supervision. Before executing, inspect the installed binary's current `runtimes connect --help` because provider flags are versioned.

If native `runtimes connect` cannot create the remote Tunnel in the user's current authorization setup, fall back to the provider's supported Tunnel UI or `admin tunnels create` path. Do not fall back to an ad-hoc public network tunnel.

## 7. Existing explicit Tunnel path

An existing Tunnel can be attached intentionally when the user or a trusted deployment record provides its exact Tunnel ID.

Conceptually:

```text
tunnel-client runtimes connect
  --alias <local-alias>
  --tunnel-id <explicit-tunnel-id>
  --runtime-api-key env:CONTROL_PLANE_API_KEY
  --mcp-command "node <generated-runtime>/server.mjs"
```

This is **not** the default for a fresh ILYNTO deployment when unrelated account Tunnels already exist.

## 8. Human Boundaries

The agent may automate provider CLI work after the necessary credential references/scopes are available, but it must stop for irreducible account authority such as:

- creating or granting a runtime key with Tunnels Read + Use;
- creating/providing an Admin API key when Tunnel CRUD needs it;
- granting Tunnels Manage permission;
- selecting/correcting organization/workspace scope when it is materially ambiguous;
- OpenAI login/MFA/account approval.

Never print the key value merely to prove it exists. Prefer `env:...`, `file:...`, or provider-supported protected references.

## 9. Workspace visibility

A Tunnel can exist in Platform and still not appear in the desired ChatGPT workspace if its scope/permissions are wrong.

When the target ChatGPT binding belongs to a workspace, include/verify the correct workspace scope before declaring the Tunnel ready for binding.

## 10. Activation and readiness

Tunnel creation is not completion.

For the currently observed official client, newly created remote Tunnels may need roughly 25–30 seconds before they become active/ready. Treat that delay as version-specific.

After `runtimes connect`, always use the current equivalent of:

```text
tunnel-client runtimes status <alias> --json
```

Require current evidence for:

```text
process_running = true
healthy = true
ready = true
```

If creation succeeded but readiness is delayed, wait/recheck the same deployment. Do not create a second Tunnel just because the first one has not propagated yet.

## 11. Stdio single-active-runtime rule

For stdio MCP deployment, do not run multiple active `tunnel-client` instances against the same Tunnel ID. The official client documents that separate instances own separate MCP child processes and requests may otherwise reach different children.

Before replacing/restarting an stdio runtime:

1. identify the existing local alias/runtime;
2. stop it cleanly;
3. start/connect the replacement;
4. verify ready state;
5. never overlap two active instances for the same Tunnel ID.

## 12. Cleanup semantics

Local runtime alias removal and remote Tunnel deletion are different actions.

Default uninstall should be conservative:

- stop the local runtime;
- remove generated local alias/profile/runtime files when requested;
- do **not** delete the remote Tunnel automatically unless the owner explicitly intends remote resource removal;
- if the deployment is permanently retired, offer revocation of the corresponding runtime key and intentional remote Tunnel deletion.

## 13. Completion receipt

A provisioning agent should retain/return non-secret evidence similar to:

```yaml
deployment:
  recipe: gpt-pc-bridge.windows
  device_label: Bayashi Laptop
  local_alias: ilynto-gpt-pc-bridge-bayashi-laptop
  tunnel_name: ILYNTO GPT-PC Bridge - Bayashi Laptop
  tunnel_id: <provider id>
  ownership_verified: true
runtime:
  process_running: true
  healthy: true
  ready: true
channel:
  name: main
secrets_exposed: false
```

The visible Tunnel name is for humans. The deployment UUID + exact Tunnel ID + provider metadata marker are what make automatic reuse safe.
