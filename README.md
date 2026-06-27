# Verifly MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server for the
**[Verifly](https://verifly.email)** email-verification API. It lets any
MCP-capable agent (Claude Desktop, Claude Code, Custom GPTs via a bridge, etc.)
verify emails, clean lists, extract addresses from text, and check domain health
through Verifly's REST API.

## Tools

| Tool | What it does | REST endpoint |
|------|--------------|---------------|
| `verify_email` | Verify a single address (verdict, flags, recommendation, credits) | `GET /api/v1/verify` |
| `verify_batch` | Verify a list synchronously (per-address verdicts) | `POST /api/v1/verify/batch` |
| `clean_email_list` | Dedupe + drop invalid/disposable/role from a list | `POST /api/v1/clean` |
| `extract_emails` | Pull email addresses out of free-form text | `POST /api/v1/extract` |
| `check_domain_health` | MX / SPF / DMARC + health score for a domain | `GET /api/tools/domain-health` |
| `get_credits` | Remaining credits + usage (free, no credits) | `GET /api/v1/credits` |

## Authentication

Get an API key from <https://verifly.email>. The server reads it from the
`VERIFLY_API_KEY` environment variable. The hosted HTTP transport also accepts a
per-request `Authorization: Bearer <key>` header (which overrides the env var),
so each caller can supply their own key.

## Install / Run (stdio — primary)

```bash
npx verifly-mcp-server
```

or install globally:

```bash
npm install -g verifly-mcp-server
verifly-mcp-server
```

### Claude Desktop config

`claude_desktop_config.json`:

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

## Hosted HTTP transport

A Streamable-HTTP server for hosting behind nginx (e.g. at
`https://verifly.email/mcp`).

```bash
PORT=8787 VERIFLY_API_KEY=vf_your_api_key node src/http.js
# or: PORT=8787 VERIFLY_API_KEY=vf_... npm run start:http
```

Environment variables:

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8787` | Listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `MCP_PATH` | `/mcp` | Path the MCP endpoint is served on |
| `VERIFLY_API_KEY` | — | Fallback key when a request sends no `Authorization` header |
| `VERIFLY_BASE_URL` | `https://verifly.email` | API base override |

- MCP endpoint: `POST {MCP_PATH}` (stateless Streamable HTTP).
- Health check: `GET /healthz` → `{"ok":true}`.
- Per request, the key is taken from `Authorization: Bearer <key>` if present,
  otherwise from `VERIFLY_API_KEY`.

Example raw call:

```bash
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer vf_your_api_key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"verify_email","arguments":{"email":"lead@example.com"}}}'
```

### nginx location (reverse proxy)

```nginx
location /mcp {
    proxy_pass http://127.0.0.1:8787/mcp;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Connection "";
    proxy_buffering off;        # needed for streaming/SSE responses
    proxy_read_timeout 300s;
}
```

## Test

```bash
VERIFLY_API_KEY=vf_your_api_key npm run test:e2e
```

Drives the stdio server through the MCP protocol and performs a real
`verify_email` + `get_credits` call against the live API.

## License

MIT
