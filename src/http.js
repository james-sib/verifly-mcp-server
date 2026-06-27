#!/usr/bin/env node
// HTTP (Streamable HTTP) entry point — for hosting behind nginx at
// https://verifly.email/mcp. Stateless: a fresh server+transport per request.
//
// API key resolution per request:
//   1. Authorization: Bearer <key> header on the incoming MCP request, else
//   2. VERIFLY_API_KEY environment variable.
//
// Config: PORT (default 8787), HOST (default 0.0.0.0), MCP_PATH (default /mcp).

import http from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "0.0.0.0";
const MCP_PATH = process.env.MCP_PATH || "/mcp";

function bearerFromHeaders(headers) {
  const auth = headers["authorization"] || headers["Authorization"];
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return undefined;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Lightweight health check.
  if (req.method === "GET" && url.pathname === "/healthz") {
    return sendJson(res, 200, { ok: true, server: "verifly-mcp-server" });
  }

  if (url.pathname !== MCP_PATH) {
    return sendJson(res, 404, { error: "Not found" });
  }

  // Stateless streamable-http: per-request server + transport.
  if (req.method === "POST") {
    let parsedBody;
    try {
      parsedBody = await readBody(req);
    } catch {
      return sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error" },
        id: null,
      });
    }

    const apiKey = bearerFromHeaders(req.headers) || process.env.VERIFLY_API_KEY;
    const server = buildServer(() => apiKey);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
      console.error("Request error:", err);
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
    return;
  }

  // GET/DELETE on the MCP path with no session are not supported in stateless mode.
  res.writeHead(405, { "Content-Type": "application/json", Allow: "POST" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed (stateless server: use POST)" },
      id: null,
    })
  );
});

httpServer.listen(PORT, HOST, () => {
  console.error(`verifly-mcp-server (http) listening on http://${HOST}:${PORT}${MCP_PATH}`);
});

// Keep randomUUID referenced for environments that tree-shake; harmless.
void randomUUID;
