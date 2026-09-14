# GPT-PC Bridge — Security Boundary

Status: **PARTIALLY_PROVEN**

A GPT-PC Bridge is intentionally powerful. Treat it as granting the connected ChatGPT session substantial authority under the current Windows user account.

The goal is not to pretend generic shell access is harmless. The goal is to make the trust boundary explicit, reduce unnecessary exposure, and keep exceptional authority changes outside the ordinary fast path.

## Threat model

Important risks include:

1. compromise of the user's ChatGPT/browser session;
2. compromise of tunnel/runtime credentials;
3. a lower-trust local Windows principal modifying MCP/tunnel startup code;
4. prompt injection in untrusted web/mail/document content causing misuse of tools;
5. supply-chain replacement of local scripts/binaries/dependencies;
6. accidental expansion from current-user authority to Administrator/system-wide persistence;
7. direct public exposure of an MCP listener;
8. secrets appearing in logs, command lines, Git, telemetry, or model context.

## Baseline network boundary

Required default:

```text
Preferred clean install: stdio MCP child (no MCP network listener)
HTTP alternative: MCP listener on 127.0.0.1 only
Tunnel operator/health UI: 127.0.0.1 only when locally exposed
Remote access: supported outbound Secure MCP Tunnel
Direct public MCP port: disabled
```

Do not replace the supported tunnel with an ad-hoc public forwarding service merely to avoid account setup. When stdio is used, keep protocol/log separation strict: MCP traffic owns stdout and diagnostics go to stderr.

## Authority model

### Normal fast path

Ordinary project development/automation may use current-user capabilities such as:

- normal filesystem operations;
- ordinary shell/CLI execution;
- local test/build tools;
- Git operations under existing user credentials;
- process start/stop for user-owned processes.

### Exceptional Human Boundary

Require explicit human involvement for operations such as:

- UAC/Administrator elevation;
- changes to firewall/Defender/security policy;
- Windows service or privileged scheduled-task installation;
- trust-root or MCP/tunnel security configuration weakening;
- credential store/private-key access outside a dedicated maintenance path;
- major irreversible system/production deletion;
- significant financial spend;
- public publish/send where the user's workflow requires explicit approval.

Do not make every normal command ask for approval. That produces security theater and destroys usability.

## Secret containment

Generic filesystem/shell capability should not make credential discovery the default behavior.

At minimum consider protecting:

- `.env` / `.env.*` except documented example/template files;
- SSH private-key directories/files;
- browser credential/session stores;
- cloud credential stores;
- API-key/credential JSON files;
- private key / PFX / P12 files;
- tunnel runtime/admin credential material;
- MCP/tunnel trust/config roots;
- OS credential stores.

A dedicated credential-maintenance capability may access selected protected material under a Human Boundary if needed.

### Do not overclaim

Static filename/path/command classification is defense in depth, not a cryptographic sandbox. Same-user arbitrary shell can often find indirect ways around lexical rules.

If the threat model requires real isolation, add an OS/container/sandbox boundary or remove generic shell authority.

## Persistence boundary

Generic remote execution should not silently create persistence in sensitive locations.

Consider protecting generic writes to:

- Windows Startup locations;
- system Scheduled Tasks directory / privileged task creation;
- service configuration;
- PowerShell profile/startup locations;
- `.git/hooks`;
- Git config settings that can execute commands or rewrite transport behavior;
- system `hosts` file;
- MCP/tunnel executable/startup/trust files.

Intentional persistence setup belongs in a typed setup/maintenance path with explicit verification and rollback.

## Local control-plane integrity

Separate the runtime/control-plane files from ordinary project workspaces.

A hardened Windows deployment should aim for:

- MCP/tunnel binaries and launchers writable only by the owning user plus required Administrators/SYSTEM identities;
- project/workspace folders remaining writable for normal development;
- runtime key storage not readable by unrelated local users;
- critical startup/config files integrity-checked at startup/restart rather than on every tool call;
- reversible backup/rollback before security-boundary updates.

Avoid locking an entire development root just because a small control-plane subdirectory needs stronger ACLs.

## Tunnel credential split

Maintain the provider's separation:

```text
Runtime API key
  -> long-lived tunnel runtime
  -> minimum tunnel Read + Use scope needed

Admin API key
  -> tunnel CRUD/administration only
  -> do not give to long-lived daemon
```

Do not commit either key.

## Request / transport provenance

If the transport exposes authenticated request metadata, a local MCP may validate consistency before remote mutations.

The live reference deployment checks consistency between independent OpenAI tunnel request-context fields before mutation. The portable principle is:

> Remote mutation should be admitted only when the request arrived through the expected authenticated transport context, without adding another cloud/auth round trip to every local tool call.

However, transport authentication does **not** prove that a model-generated instruction came directly from the owner rather than from malicious content the model previously read.

## Prompt-injection boundary

Treat content provenance separately from transport identity.

External content may provide data but should not be able to mint authority to:

- access secrets;
- widen execution scope;
- weaken security policy;
- grant admin privileges;
- modify trust roots;
- approve irreversible/high-impact actions.

A fully provenance-aware authority model is stronger than command keyword filtering. If that distinction is unavailable, document the residual risk rather than claiming prompt-injection immunity.

## Output and logging

Default rules:

- bounded stdout/stderr;
- no full prompts in security/telemetry logs by default;
- no plaintext secrets;
- compact denial/boundary metadata only;
- local log rotation;
- redact keys by both field name and recognizable secret formats where practical;
- make truncation explicit.

## Integrity / drift

Check critical runtime files at startup/restart rather than adding hashing cost to every ordinary call.

Useful targets:

- MCP server entrypoint/package lock;
- tunnel binary/profile/launcher;
- policy/trust configuration;
- helper executable expected hashes.

On drift, choose behavior according to availability needs:

- physically attended/high-assurance system: fail closed may be appropriate;
- remote-only owner: warn + explicit Human Boundary/recovery may avoid self-lockout.

Document the chosen tradeoff.

## Security acceptance matrix

Before claiming a generated bridge is hardened, test at least:

| Scenario | Expected |
|---|---|
| harmless project read | allowed |
| harmless scratch write | allowed + verified |
| normal current-user shell | allowed |
| direct public listener | not present |
| generic read of protected credential file | denied/bounded |
| generic write to control-plane/trust file | denied/bounded |
| privileged system change | Human Boundary |
| stale file/Git fence | no mutation; replan |
| malformed/spoofed remote transport metadata when attestation exists | no mutation |
| external-content instruction attempting authority expansion | must not silently expand authority |
| security denial logging | metadata only, no secret body |

## Performance requirement

Security improvements must be benchmarked against the ordinary fast path. Prefer controls that add no network/model round trip per operation.

The live source system demonstrated multiple security-hardening stages without measurable hot-path slowdown by keeping normal checks local/in-process and moving expensive integrity checks to startup/restart boundaries.
