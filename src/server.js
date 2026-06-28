// Builds a Verifly MCP server instance and registers all tools.
// `resolveApiKey` is a function returning the bearer key for the current
// request context (env for stdio; per-request Authorization header for HTTP).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  veriflyRequest,
  submitBulk,
  getJobStatus,
  getJobResults,
  listJobs,
  getUsage,
  getAccount,
  getPackages,
  buyCredits,
  registerAccount,
} from "./api.js";

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

  server.registerTool(
    "submit_bulk",
    {
      title: "Submit an async bulk verification job",
      description:
        "Submit a list of email addresses as an asynchronous bulk verification job — the " +
        "right tool for large lists. Returns immediately with a job_id, status, and the " +
        "check_status_url / results_url to poll. Small lists may complete inline (status " +
        "'completed'); larger ones return status 'pending' — poll get_job_status until it is " +
        "'completed', then call get_job_results. Optionally register a webhook_url (public " +
        "HTTPS) to be notified when the job finishes.",
      inputSchema: {
        emails: z
          .array(z.string())
          .min(1)
          .describe("Email addresses to verify in this job (deduped server-side)."),
        webhook_url: z
          .string()
          .optional()
          .describe("Optional public HTTPS URL to POST a job.completed notification to."),
      },
    },
    async ({ emails, webhook_url }) => {
      try {
        return jsonContent(await submitBulk(resolveApiKey(), { emails, webhook_url }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "get_job_status",
    {
      title: "Get the status of a bulk verification job",
      description:
        "Fetch the current status and progress of a bulk verification job by its job_id " +
        "(status, percent progress, processed count, and a valid/invalid/risky summary). " +
        "Poll this after submit_bulk until status is 'completed', then call get_job_results.",
      inputSchema: {
        job_id: z.string().describe("The job_id returned by submit_bulk."),
      },
    },
    async ({ job_id }) => {
      try {
        return jsonContent(await getJobStatus(resolveApiKey(), job_id));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "get_job_results",
    {
      title: "Get the results of a completed bulk job",
      description:
        "Fetch the full per-address results of a completed bulk verification job by job_id " +
        "(each email's verdict, recommendation, and reason) plus the valid/invalid/risky " +
        "summary and credits used. The job must be 'completed' — check get_job_status first.",
      inputSchema: {
        job_id: z.string().describe("The job_id returned by submit_bulk."),
      },
    },
    async ({ job_id }) => {
      try {
        return jsonContent(await getJobResults(resolveApiKey(), job_id));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "list_jobs",
    {
      title: "List bulk verification jobs",
      description:
        "List the account's bulk verification jobs, most recent first, with their status, " +
        "progress, and summary. Optionally filter by status and paginate. Use this to find " +
        "past jobs and their job_ids.",
      inputSchema: {
        status: z
          .enum(["pending", "processing", "completed", "failed"])
          .optional()
          .describe("Only return jobs in this status."),
        limit: z
          .number()
          .int()
          .optional()
          .describe("Max jobs to return (1-100, default 50)."),
        offset: z
          .number()
          .int()
          .optional()
          .describe("Pagination offset (default 0)."),
      },
    },
    async ({ status, limit, offset }) => {
      try {
        return jsonContent(await listJobs(resolveApiKey(), { status, limit, offset }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "get_usage",
    {
      title: "Get detailed usage statistics",
      description:
        "Return detailed usage statistics for the account over a period (day, week, or " +
        "month): total credits used, emails processed, request counts broken down by " +
        "endpoint and source, a daily breakdown, and recent activity.",
      inputSchema: {
        period: z
          .enum(["day", "week", "month"])
          .optional()
          .describe("Reporting period. Default 'month'."),
        limit: z
          .number()
          .int()
          .optional()
          .describe("Max recent log entries to include (default 100, max 1000)."),
      },
    },
    async ({ period, limit }) => {
      try {
        return jsonContent(await getUsage(resolveApiKey(), { period, limit }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "get_account",
    {
      title: "Get account information",
      description:
        "Return the account profile for the current API key: email, name, company, " +
        "timezone, remaining credits, total credits used, number of API keys, and plan. " +
        "Costs no credits.",
      inputSchema: {},
    },
    async () => {
      try {
        return jsonContent(await getAccount(resolveApiKey()));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "get_packages",
    {
      title: "List buyable credit packages",
      description:
        "List the credit packages available for purchase (id, name, credit amount, price in " +
        "USD, and price per 1k credits). Use the returned package id with buy_credits.",
      inputSchema: {},
    },
    async () => {
      try {
        return jsonContent(await getPackages(resolveApiKey()));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "buy_credits",
    {
      title: "Buy credits (returns a payment link or crypto invoice)",
      description:
        "Start a purchase of a credit package and return a way to pay. This does NOT complete " +
        "a payment by itself — it returns a payment link / address:\n" +
        "• method 'stripe' → returns a checkout_url. Paying by card requires a HUMAN to open " +
        "that link and enter card details; an agent cannot finish a card payment on its own.\n" +
        "• method 'crypto' → returns a Plisio invoice with a checkout_url AND, when you pass a " +
        "`currency` (BTC, ETH, LTC, USDT, USDC), a RAW wallet `address` + `amount`. An " +
        "autonomous agent CAN pay this from a crypto wallet with no browser/human, then credits " +
        "are added automatically once the payment confirms. Prefer crypto for fully autonomous " +
        "top-ups. Get a package id from get_packages first.",
      inputSchema: {
        package_id: z
          .string()
          .describe("The package id to buy (from get_packages)."),
        method: z
          .enum(["stripe", "crypto"])
          .optional()
          .describe("Payment method. 'stripe' = card link (needs a human), 'crypto' = wallet-payable invoice. Default 'stripe'."),
        currency: z
          .enum(["BTC", "ETH", "LTC", "USDT", "USDC"])
          .optional()
          .describe("For method 'crypto': the coin to pay in; returns a raw wallet address an agent can pay autonomously."),
      },
    },
    async ({ package_id, method, currency }) => {
      try {
        return jsonContent(await buyCredits(resolveApiKey(), { package_id, method, currency }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  server.registerTool(
    "register_account",
    {
      title: "Self-register a new Verifly account + API key",
      description:
        "Programmatically create a brand-new Verifly account — this is how an agent " +
        "self-onboards with no human in the loop. Requires only an email and a password " +
        "(min 8 chars; disposable email domains are rejected). The new account starts with " +
        "free credits. The response includes the new account id/email and a freshly generated " +
        "`api_key.key` that is shown ONCE — capture and store it immediately, it cannot be " +
        "retrieved again. Subsequent tool calls can then use that key as the bearer token.",
      inputSchema: {
        email: z.string().describe("Email for the new account (not a disposable domain)."),
        password: z
          .string()
          .min(8)
          .describe("Password for the new account (minimum 8 characters)."),
      },
    },
    async ({ email, password }) => {
      try {
        return jsonContent(await registerAccount({ email, password }));
      } catch (err) {
        return errorContent(err);
      }
    }
  );

  return server;
}
