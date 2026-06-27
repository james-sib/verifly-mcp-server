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
