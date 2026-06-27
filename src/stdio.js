#!/usr/bin/env node
// Stdio entry point — the primary transport for `npx verifly-mcp-server`,
// Claude Desktop, and local agents. Reads the key from VERIFLY_API_KEY.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

async function main() {
  const server = buildServer(() => process.env.VERIFLY_API_KEY);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs must go to stderr — stdout is the MCP protocol channel.
  console.error("verifly-mcp-server (stdio) ready");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
