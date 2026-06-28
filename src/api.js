// Thin client for the Verifly REST API (https://verifly.email).
// Every call authenticates with `Authorization: Bearer <VERIFLY_API_KEY>`.

export const VERIFLY_BASE = process.env.VERIFLY_BASE_URL || "https://verifly.email";

export class VeriflyApiError extends Error {
  constructor(status, body) {
    const detail =
      typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body);
    super(`Verifly API error ${status}: ${detail}`);
    this.name = "VeriflyApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Perform an authenticated request against the Verifly API.
 *
 * @param {string} path        Path beginning with "/" (e.g. "/api/v1/verify").
 * @param {object} opts
 * @param {string} opts.apiKey Bearer key.
 * @param {string} [opts.method="GET"]
 * @param {object} [opts.query]  Query params.
 * @param {object} [opts.body]   JSON body (POST/PATCH).
 * @returns {Promise<any>} Parsed JSON response.
 */
export async function veriflyRequest(path, { apiKey, method = "GET", query, body } = {}) {
  if (!apiKey) {
    throw new Error(
      "Missing Verifly API key. Set the VERIFLY_API_KEY environment variable " +
        "(or pass an Authorization: Bearer header to the HTTP server)."
    );
  }

  const url = new URL(path, VERIFLY_BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!res.ok) throw new VeriflyApiError(res.status, data);
  return data;
}

// ---------------------------------------------------------------------------
// Named, typed convenience wrappers around veriflyRequest. Each takes the
// bearer key as its first argument; the MCP tools call these so the whole
// Verifly workflow (submit a bulk job, poll it, fetch results, manage the
// account, buy credits, self-register) is reachable without raw HTTP.
// ---------------------------------------------------------------------------

/** POST /api/v1/verify/bulk — create an async verification job. */
export function submitBulk(apiKey, { emails, webhook_url } = {}) {
  const body = { emails };
  if (webhook_url) body.webhook_url = webhook_url;
  return veriflyRequest("/api/v1/verify/bulk", { apiKey, method: "POST", body });
}

/** GET /api/v1/jobs/{id} — job status / progress. */
export function getJobStatus(apiKey, jobId) {
  return veriflyRequest(`/api/v1/jobs/${encodeURIComponent(jobId)}`, { apiKey });
}

/** GET /api/v1/jobs/{id}/results — per-address results (job must be completed). */
export function getJobResults(apiKey, jobId) {
  return veriflyRequest(`/api/v1/jobs/${encodeURIComponent(jobId)}/results`, { apiKey });
}

/** GET /api/v1/jobs — list jobs (optional status filter + pagination). */
export function listJobs(apiKey, { status, limit, offset } = {}) {
  return veriflyRequest("/api/v1/jobs", { apiKey, query: { status, limit, offset } });
}

/** GET /api/v1/usage — usage statistics for a period (day | week | month). */
export function getUsage(apiKey, { period, limit } = {}) {
  return veriflyRequest("/api/v1/usage", { apiKey, query: { period, limit } });
}

/** GET /api/v1/account — account profile, credits, plan, key count. */
export function getAccount(apiKey) {
  return veriflyRequest("/api/v1/account", { apiKey });
}

/** GET /api/v1/billing?action=packages — available credit packages. */
export function getPackages(apiKey) {
  return veriflyRequest("/api/v1/billing", { apiKey, query: { action: "packages" } });
}

/** POST /api/v1/billing — create a checkout session (stripe) or crypto invoice. */
export function buyCredits(apiKey, { package_id, method = "stripe", currency } = {}) {
  const body = { package_id, method };
  if (currency) body.currency = currency;
  return veriflyRequest("/api/v1/billing", { apiKey, method: "POST", body });
}

/** POST /api/v1/autonomous/register — self-onboard a brand-new account + key. */
export function registerAccount({ email, password } = {}) {
  // No API key required: this is how an unauthenticated agent gets its first key.
  return veriflyRequest("/api/v1/autonomous/register", {
    apiKey: "unauthenticated", // endpoint ignores auth; satisfies the key guard
    method: "POST",
    body: { email, password },
  });
}
