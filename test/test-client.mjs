// End-to-end test of the stdio MCP server against the LIVE Verifly API.
// Usage: VERIFLY_API_KEY=vf_... node test/test-client.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, "../src/stdio.js");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: { ...process.env },
});

const client = new Client({ name: "verifly-e2e-test", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const verify = await client.callTool({
  name: "verify_email",
  arguments: { email: "support@gmail.com" },
});
console.log("verify_email ->\n" + verify.content[0].text);

const credits = await client.callTool({ name: "get_credits", arguments: {} });
console.log("get_credits ->\n" + credits.content[0].text);

await client.close();
process.exit(0);
