// Builds a Verifly MCP server instance and registers all tools.
// `resolveApiKey` is a function returning the bearer key for the current
// request context (env for stdio; per-request Authorization header for HTTP).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { veriflyRequest } from "./api.js";

export const SERVER_NAME = "verifly-mcp-server";
export const SERVER_VERSION = "1.0.0";

function jsonContent(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorContent(err) {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${err.message || String(err)}` }],
  };
}

/**
 * @param {() => string|undefined} resolveApiKey
 * @returns {McpServer}
 */
export function buildServer(resolveApiKey) {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  const call = async (path, opts) =>
    veriflyRequest(path, { apiKey: resolveApiKey(), ...opts });

  server.registerTool(
    "verify_email",
    {
      title: "Verify a single email address",
      description:
        "Verify one email address in real time. Returns a deliverability verdict " +
        "(valid / invalid / risky / unknown), the reason, detailed flags (disposable, " +
        "role account, catch-all, MX, SMTP), a send/reject recommendation, and credit usage.",
      inputSchema: {
        email: z.string().describe("The email address to verify, e.g. lead@example.com"),
      },
    },
    async ({ email }) => {
      try {
        return jsonContent(await call("/api/v1/verify", { query: { email } }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "verify_batch",
    {
      title: "Verify a batch of email addresses",
      description:
        "Synchronously verify a list of email addresses (best for up to a few hundred). " +
        "Returns a per-address verdict for each email. For very large lists use the bulk " +
        "async endpoint instead.",
      inputSchema: {
        emails: z
          .array(z.string())
          .min(1)
          .describe("Array of email addresses to verify."),
        exclude_role_accounts: z
          .boolean()
          .optional()
          .describe("Flag/exclude role accounts (info@, sales@, ...). Default false."),
        exclude_public_domains: z
          .boolean()
          .optional()
          .describe("Flag/exclude public domains (gmail.com, ...). Default false."),
      },
    },
    async ({ emails, exclude_role_accounts, exclude_public_domains }) => {
      try {
        const options = {};
        if (exclude_role_accounts !== undefined)
          options.exclude_role_accounts = exclude_role_accounts;
        if (exclude_public_domains !== undefined)
          options.exclude_public_domains = exclude_public_domains;
        const body = { emails };
        if (Object.keys(options).length) body.options = options;
        return jsonContent(await call("/api/v1/verify/batch", { method: "POST", body }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "clean_email_list",
    {
      title: "Clean an email list",
      description:
        "Clean a list of email addresses before an import or campaign: dedupes, removes " +
        "invalid syntax, and (optionally) strips disposable and role accounts. Returns the " +
        "cleaned list plus a summary of what was removed.",
      inputSchema: {
        emails: z.array(z.string()).min(1).describe("Email addresses to clean."),
        remove_disposable: z
          .boolean()
          .optional()
          .describe("Remove disposable/throwaway addresses. Default true."),
        exclude_role_accounts: z
          .boolean()
          .optional()
          .describe("Remove role accounts (info@, support@, ...). Default false."),
      },
    },
    async ({ emails, remove_disposable, exclude_role_accounts }) => {
      try {
        const options = {};
        if (remove_disposable !== undefined) options.remove_disposable = remove_disposable;
        if (exclude_role_accounts !== undefined)
          options.exclude_role_accounts = exclude_role_accounts;
        const body = { emails };
        if (Object.keys(options).length) body.options = options;
        return jsonContent(await call("/api/v1/clean", { method: "POST", body }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "extract_emails",
    {
      title: "Extract email addresses from text",
      description:
        "Extract all email addresses found in a block of free-form text (notes, pasted " +
        "documents, signatures). Optionally deduplicates and lowercases the results.",
      inputSchema: {
        text: z.string().describe("Free-form text to scan for email addresses."),
        deduplicate: z
          .boolean()
          .optional()
          .describe("Remove duplicate addresses. Default true."),
        lowercase: z
          .boolean()
          .optional()
          .describe("Lowercase all extracted addresses. Default true."),
      },
    },
    async ({ text, deduplicate, lowercase }) => {
      try {
        const options = {};
        if (deduplicate !== undefined) options.deduplicate = deduplicate;
        if (lowercase !== undefined) options.lowercase = lowercase;
        const body = { text };
        if (Object.keys(options).length) body.options = options;
        return jsonContent(await call("/api/v1/extract", { method: "POST", body }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "check_domain_health",
    {
      title: "Check email-domain health (MX / SPF / DMARC)",
      description:
        "Check the DNS and deliverability health of an email domain: MX records, SPF, DMARC, " +
        "and an overall health score. Useful for diagnosing why a domain bounces or for " +
        "validating a sending domain.",
      inputSchema: {
        domain: z.string().describe("Domain to check, e.g. example.com"),
      },
    },
    async ({ domain }) => {
      try {
        // Note: domain-health lives at /api/tools (not /api/v1).
        return jsonContent(await call("/api/tools/domain-health", { query: { domain } }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "get_credits",
    {
      title: "Get remaining Verifly credits",
      description:
        "Return the API key's remaining verification credits and recent usage (today / this " +
        "month) and plan. Costs no credits.",
      inputSchema: {},
    },
    async () => {
      try {
        return jsonContent(await call("/api/v1/credits"));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  return server;
}
