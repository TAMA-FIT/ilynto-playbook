# GPT-PC Bridge — Official Provider Sources

Provider behavior changes faster than this repository. For OpenAI-specific tunnel/account/UI details, verify current official sources during provisioning.

## Secure MCP Tunnel client

Official source repository:

```text
https://github.com/openai/tunnel-client
```

The repository describes `tunnel-client` as the customer-run Secure MCP Tunnel client for connecting private or localhost MCP servers to supported OpenAI products without exposing the MCP server to the public Internet.

Useful provider documentation paths from the official repository include:

```text
https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
https://github.com/openai/tunnel-client/blob/master/docs/onboarding.md
https://github.com/openai/tunnel-client/blob/master/docs/permissions.md
https://github.com/openai/tunnel-client/blob/master/docs/configuration.md
https://github.com/openai/tunnel-client/blob/master/docs/connectors.md
https://github.com/openai/tunnel-client/blob/master/docs/troubleshooting.md
```

For an installed binary, prefer its current self-documentation before assuming example flags are still identical:

```text
tunnel-client --version
tunnel-client help quickstart
tunnel-client profiles samples list
tunnel-client profiles samples show sample_mcp_stdio_local
tunnel-client runtimes connect --help
tunnel-client runtimes status --help
```

## ChatGPT custom MCP / app availability

Current OpenAI Help Center reference:

```text
https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
```

OpenAI's public documentation confirms that local/private MCP servers are not connected directly from ChatGPT; Secure MCP Tunnel is the supported path for private/on-prem/developer-machine MCP servers when the relevant product/account supports that connection.

### Availability warning

Do **not** hard-code plan eligibility from an old screenshot, old blog post, or this repository.

The maintainer has a working ChatGPT Plugin/Channel flow in the observed environment, but public plan/workspace availability and UI wording can differ or change over time. Therefore the recipe treats this as an external prerequisite:

> The user's ChatGPT account/workspace must expose a supported custom MCP Plugin/App/connector binding surface for the created tunnel Channel.

If that surface is absent, report an account/product availability boundary. Do not replace the supported path with an ad-hoc public tunnel merely to force connectivity.

## Credential roles

The current official tunnel-client quickstart distinguishes:

- **Runtime API key** — long-lived tunnel runtime credential; principal needs the applicable Tunnel Read + Use permission.
- **Admin API key** — tunnel CRUD/administration only; do not give it to the long-lived daemon.
- **Tunnel ID** — the tunnel resource identifier, created/managed through the supported tunnel management surface or admin CLI when authorized.

The CLI and provider documentation are the authority for current permission names and scope behavior.

## Why this file exists

ILYNTO should preserve durable architecture and orchestration knowledge while delegating provider-version facts to the provider's current documentation.

That separation lets a short Codex provisioning prompt remain stable even when OpenAI changes UI labels, CLI flags, plan availability, or account-management workflows.
