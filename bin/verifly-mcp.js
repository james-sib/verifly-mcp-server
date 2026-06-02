#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const API_BASE = (process.env.VERIFLY_API_BASE || 'https://verifly.email/api/v1').replace(/\/$/, '')
const PUBLIC_BASE = 'https://verifly.email'
const API_KEY = process.env.VERIFLY_API_KEY || ''
const server = new Server({ name: 'verifly-mcp', version: '0.1.0' }, { capabilities: { tools: {} } })
function requireKey() { if (!API_KEY) throw new Error('Missing VERIFLY_API_KEY') }
async function api(route, init = {}) { requireKey(); const response = await fetch(API_BASE + route, { ...init, headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json', ...(init.headers || {}) } }); const text = await response.text(); let data; try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } } if (!response.ok) throw new Error(data?.error || data?.message || response.statusText); return data }
async function publicApi(route) { const response = await fetch(PUBLIC_BASE + route); const data = await response.json(); if (!response.ok) throw new Error(data?.error || response.statusText); return data }
function asText(data) { return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] } }
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
  { name: 'verify_email', description: 'Verify one email address with Verifly. Requires VERIFLY_API_KEY.', inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } },
  { name: 'clean_email_list', description: 'Clean a list of email addresses with Verifly. Requires VERIFLY_API_KEY.', inputSchema: { type: 'object', properties: { emails: { type: 'array', items: { type: 'string' } } }, required: ['emails'] } },
  { name: 'extract_emails', description: 'Extract email addresses from raw text with Verifly. Requires VERIFLY_API_KEY.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'check_domain_health', description: 'Check public MX, SPF, and DMARC records for a domain. No API key required.', inputSchema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] } }
] }))
server.setRequestHandler(CallToolRequestSchema, async (request) => { const args = request.params.arguments || {}; if (request.params.name === 'verify_email') return asText(await api('/verify?email=' + encodeURIComponent(args.email || ''))); if (request.params.name === 'clean_email_list') return asText(await api('/clean', { method: 'POST', body: JSON.stringify({ emails: args.emails || [] }) })); if (request.params.name === 'extract_emails') return asText(await api('/extract', { method: 'POST', body: JSON.stringify({ text: args.text || '', options: { deduplicate: true, lowercase: true } }) })); if (request.params.name === 'check_domain_health') return asText(await publicApi('/api/tools/domain-health?domain=' + encodeURIComponent(args.domain || ''))); throw new Error('Unknown tool: ' + request.params.name) })
await server.connect(new StdioServerTransport())
