# GPT-PC Bridge — ChatGPT Binding Handoff

Status: **PROVIDER UI / ACCOUNT BOUNDARY**

Use this document only after the local MCP and the exact managed Tunnel runtime are proven ready.

The goal is to make the final human step deterministic: the provisioning agent should tell the user **which Tunnel was created, which Channel to select, and where to open the current ChatGPT connector/app settings**.

## 1. Preconditions

Do not send the user to ChatGPT binding setup until current evidence proves the exact deployment runtime is usable:

```text
process_running = true
healthy = true
ready = true
ownership_verified = true
```

The exact Tunnel ID and deployment UUID must belong to the current GPT-PC Bridge deployment. Do not offer an unrelated existing Tunnel merely because it appears in the same OpenAI account/workspace.

## 2. Current provider entry points

Current official `tunnel-client` documentation identifies these operator entry points:

```text
ChatGPT connector settings
https://chatgpt.com/#settings/Connectors

OpenAI Tunnel management
https://platform.openai.com/settings/organization/tunnels

OpenAI Help — Developer mode and MCP apps in ChatGPT
https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
```

Provider UI names and plan/workspace availability can change. If the direct settings URL redirects or the expected surface is absent, follow the current official Help Center instructions and current account UI rather than inventing an unsupported route.

## 3. Human handoff contract

When the local side is ready, the provisioning agent should return a handoff containing at least:

```yaml
chatgpt_binding_required: true
chatgpt_settings_url: https://chatgpt.com/#settings/Connectors
official_help_url: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
tunnel_name: ILYNTO GPT-PC Bridge - <device-label>
tunnel_id: <exact provider tunnel id>
channel: main
runtime_ready: true
```

Then give the user a short action sequence appropriate to the current UI:

```text
1. Open the ChatGPT connector/app creation surface.
2. Create a new custom Plugin/App/connector binding.
3. Give it a recognizable name, normally matching the device/use case.
4. Choose the exact Tunnel named in the handoff (or exact Tunnel ID where the UI supports it).
5. Choose/use channel `main` for the default stdio GPT-PC Bridge.
6. Save/enable the binding with only the intended permissions.
7. Return to a normal ChatGPT chat for E2E acceptance.
```

Do not ask the user to guess which Tunnel or Channel to select. The provisioning agent already knows the exact deployment identity and must surface it.

## 4. Product terminology can drift

Depending on the current ChatGPT product surface, the UI may call the object an App, Plugin, connector, custom MCP app, or similar.

Treat these labels as product UI terminology rather than architecture. The durable relationship is:

```text
ChatGPT binding
  -> exact OpenAI Tunnel
  -> channel=main
  -> tunnel-client managed runtime
  -> local stdio MCP
```

Do not rewrite the local architecture just because the product label changed.

## 5. Availability boundary

If the user's current ChatGPT account/workspace does not expose a supported custom MCP/connector binding surface:

```text
state = HUMAN_BOUNDARY or PRODUCT_AVAILABILITY_BOUNDARY
```

Return:

- the exact ready Tunnel name/ID;
- current official Help link;
- what account/workspace capability appears to be missing;
- confirmation that the local runtime/Tunnel should be left intact unless the user asks to remove it.

Do **not** replace the supported OpenAI Tunnel path with an ad-hoc public tunnel merely to bypass product availability.

## 6. End-to-end acceptance after binding

From an ordinary ChatGPT conversation using the newly created binding:

1. call `system.status`;
2. confirm the expected GPT-PC Bridge server/version/tool surface;
3. perform one harmless read;
4. create one unique scratch file;
5. read it back and verify exact content/hash;
6. delete it;
7. verify deletion;
8. run read-only `git.status` in a harmless repository if Git capability is intended;
9. verify no runtime/admin secret appeared in output.

Only after this is observed should the overall recipe report `COMPLETE_VERIFIED`.

## 7. Final completion receipt

A successful full installation should leave a receipt similar to:

```yaml
state: COMPLETE_VERIFIED
device_label: <label>
tunnel_name: ILYNTO GPT-PC Bridge - <device-label>
tunnel_id: <exact id>
channel: main
chatgpt_binding_name: <user-visible binding name>
runtime_process_running: true
runtime_healthy: true
runtime_ready: true
chatgpt_system_status_e2e: true
chatgpt_read_e2e: true
chatgpt_write_verify_cleanup_e2e: true
secrets_exposed: false
unobserved: []
```

If ChatGPT-side binding or E2E testing has not actually happened, do not mark those fields true. Report them under `unobserved` and stop at the appropriate Human/Product boundary.
