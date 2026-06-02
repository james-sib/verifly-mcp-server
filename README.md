# @verifly/mcp-server

MCP server for Verifly. It gives MCP-capable agents tools for email verification and list cleaning.

## Install

~~~bash
npm install -g @verifly/mcp-server
~~~

Until npm publishing is unblocked, download the package from https://verifly.email/downloads/verifly-agent-kit.zip.

## Configure

~~~bash
export VERIFLY_API_KEY="vf_your_key"
verifly-mcp
~~~

## Tools

- verify_email: verify one email address through the Verifly API.
- clean_email_list: clean a list of email addresses.
- extract_emails: extract email addresses from raw text.
- check_domain_health: check MX/SPF/DMARC for a domain without an API key.
