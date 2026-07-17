<p align="center">
  <img src="https://raw.githubusercontent.com/james-sib/verifly-mcp-server/master/logo.png" width="120" alt="Verifly logo" />
</p>

## Free email tools & API

- [Catch-all email verifier](https://verifly.email/tools/catch-all-checker) — check if a domain is accept-all
- [Disposable email checker](https://verifly.email/tools/disposable-email-checker)
- [Bulk email verification API](https://verifly.email/bulk-email-verification-api) — clean CSV lists
- [Email verification API for developers](https://verifly.email/email-verification-api-for-developers) — pay-as-you-go, 100 free credits, no monthly fee

# Verifly MCP Server

Agent-native **email verification** over the
[Model Context Protocol](https://modelcontextprotocol.io). This server gives any
MCP client — Cline, Claude Desktop, Claude Code, Cursor, Windsurf — a clean set
of tools to verify email addresses, clean lists, run async bulk jobs, and manage
a [Verifly](https://verifly.email) account, all without writing a single raw HTTP
call.

It is built for autonomous workflows: an agent can **self-register** for an API
key, verify a lead before sending, deduplicate and scrub an import list, kick off
a bulk job and poll it to completion, and check its own credits and usage — end
to end.

## Tools

15 tools cover the full Verifly workflow:

| Tool | What it does |
|------|--------------|
| `verify_email` | Verify a single address in real time (verdict, reason, flags, send/reject recommendation, credits) |
| `verify_batch` | Verify a list synchronously (per-address verdicts; best for up to a few hundred) |
| `clean_email_list` | Dedupe + drop invalid syntax, disposable, and role addresses from a list |
| `extract_emails` | Pull every email address out of free-form text (notes, signatures, pasted docs) |
| `check_domain_health` | MX / SPF / DMARC records + an overall health score for a domain |
| `get_credits` | Remaining verification credits + recent usage (free, no credits) |
| `submit_bulk` | Submit an async bulk verification job for large lists (returns a `job_id`; optional `webhook_url`) |
| `get_job_status` | Status + progress of a bulk job |
| `get_job_results` | Per-address results of a completed bulk job |
| `list_jobs` | List the account's bulk jobs (filter by status, paginate) |
| `get_usage` | Detailed usage statistics for a period (day / week / month) |
| `get_account` | Account profile: email, company, credits, plan, key count (free) |
| `get_packages` | List the credit packages available to purchase |
| `buy_credits` | Start a credit-package purchase and return a checkout link |
| `register_account` | Self-onboard a brand-new account; returns an `api_key` shown once |

## Authentication

Get an API key from <https://verifly.email> (or have an agent self-register with
`register_account`). The server reads the key from the `VERIFLY_API_KEY`
environment variable. Every Verifly request is authenticated with
`Authorization: Bearer <key>`.

The hosted HTTP transport also accepts a per-request `Authorization: Bearer <key>`
header (which overrides the env var), so each caller can supply their own key.

## Install (local, stdio) — recommended for Cline

```bash
npx -y verifly-mcp-server
```

or install it globally:

```bash
npm install -g verifly-mcp-server
verifly-mcp-server
```

### Client config

Add this to your MCP client config (Cline: `cline_mcp_settings.json`; Claude
Desktop: `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "verifly": {
      "command": "npx",
      "args": ["-y", "verifly-mcp-server"],
      "env": {
        "VERIFLY_API_KEY": "vf_your_api_key"
      }
    }
  }
}
```

That's the whole setup — no build step, no clone. See
[`llms-install.md`](./llms-install.md) for an agent-followable install guide.

## Hosted Streamable-HTTP transport

If you'd rather not run anything locally, Verifly hosts the same server as a
remote **Streamable-HTTP** endpoint:

```
https://verifly.email/mcp
```

Point any Streamable-HTTP-capable MCP client at that URL and pass your key as an
`Authorization: Bearer <key>` header. Example raw call:

```bash
curl -s -X POST https://verifly.email/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer vf_your_api_key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"verify_email","arguments":{"email":"lead@example.com"}}}'
```

### Self-hosting the HTTP transport

```bash
PORT=8787 VERIFLY_API_KEY=vf_your_api_key node src/http.js
# or: PORT=8787 VERIFLY_API_KEY=vf_... npm run start:http
```

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8787` | Listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `MCP_PATH` | `/mcp` | Path the MCP endpoint is served on |
| `VERIFLY_API_KEY` | — | Fallback key when a request sends no `Authorization` header |
| `VERIFLY_BASE_URL` | `https://verifly.email` | API base override |

- MCP endpoint: `POST {MCP_PATH}` (stateless Streamable HTTP).
- Health check: `GET /healthz` → `{"ok":true}`.

## Test

```bash
VERIFLY_API_KEY=vf_your_api_key npm run test:e2e
```

Drives the stdio server through the MCP protocol and performs a real
`verify_email` + `get_credits` call against the live API.

## License

MIT
