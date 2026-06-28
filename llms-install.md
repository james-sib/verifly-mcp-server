# Installing the Verifly MCP Server (guide for AI agents)

This file is for an AI coding agent (e.g. Cline) installing the Verifly MCP
server on a user's behalf. Follow these steps exactly.

## What it is

An MCP server for **email verification** via the [Verifly](https://verifly.email)
API. It exposes 15 tools: `verify_email`, `verify_batch`, `clean_email_list`,
`extract_emails`, `check_domain_health`, `get_credits`, `submit_bulk`,
`get_job_status`, `get_job_results`, `list_jobs`, `get_usage`, `get_account`,
`get_packages`, `buy_credits`, `register_account`.

## Requirements

- **Node.js >= 18** (the server has no global install or build step; `npx` runs it).
- A **Verifly API key** (`VERIFLY_API_KEY`), formatted `vf_...`.

## Step 1 — Get an API key

Ask the user for their Verifly API key. If they do not have one, they can create
one for free at <https://verifly.email>.

(Advanced/autonomous: a new account can be created programmatically with the
`register_account` tool — it takes an `email` and a `password` (min 8 chars) and
returns a fresh `api_key.key` that is shown **once**. New accounts start with free
credits. If you use this, capture and store the returned key immediately.)

## Step 2 — Add the server to the MCP config

Use the local **stdio** transport via `npx` (no clone, no build). Add this entry
to the user's MCP settings file (for Cline that is `cline_mcp_settings.json`),
merging into any existing `mcpServers` object:

```json
{
  "mcpServers": {
    "verifly": {
      "command": "npx",
      "args": ["-y", "verifly-mcp-server"],
      "env": {
        "VERIFLY_API_KEY": "vf_the_users_key"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Replace `vf_the_users_key` with the real key from Step 1.

## Step 3 — Verify it works

After the client reconnects, the `verifly` server should list 15 tools. Confirm
by calling `get_credits` (it costs no credits) — a successful response returns
the remaining credit balance and plan.

## Alternative — hosted Streamable-HTTP (no local process)

Instead of running it locally, you can point a Streamable-HTTP-capable client at
the hosted endpoint:

- URL: `https://verifly.email/mcp`
- Auth: header `Authorization: Bearer <VERIFLY_API_KEY>`

Use this only if the client supports remote Streamable-HTTP MCP servers;
otherwise prefer the `npx` stdio setup above.

## Notes

- All requests authenticate with `Authorization: Bearer <key>`; the key never
  leaves the configured `VERIFLY_API_KEY` env var (stdio) or the per-request
  header (HTTP).
- `get_credits`, `get_account`, and `check_domain_health` cost no verification
  credits; `verify_email` / `verify_batch` / bulk jobs consume credits.
