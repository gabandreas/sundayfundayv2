/**
 * Sunday Funday ERP — Lightweight Local MCP Stdio-to-HTTP Bridge
 *
 * Connects any local MCP client (Antigravity, Claude Desktop, Cursor) via stdio
 * to the authenticated Sunday Funday MCP JSON-RPC endpoint without exposing
 * host filesystem, shell execution, or raw SQL access.
 *
 * Environment variables:
 *   SUNDAYFUNDAY_MARQUEE_TOKEN  Required per-user X-Marquee-Token from /preferences?sub=ai
 *   SUNDAYFUNDAY_API_URL        Optional API base URL (default: https://sundayfunday-api.vercel.app)
 */
import * as readline from 'node:readline';

const API_BASE = (
  process.env.SUNDAYFUNDAY_API_URL || 'https://sundayfunday-api.vercel.app'
).replace(/\/$/, '');
const TOKEN = (process.env.SUNDAYFUNDAY_MARQUEE_TOKEN || '').trim();

async function forwardRpc(payload: any): Promise<any> {
  if (!TOKEN) {
    return {
      jsonrpc: '2.0',
      id: payload?.id ?? null,
      error: {
        code: -32001,
        message: 'SUNDAYFUNDAY_MARQUEE_TOKEN is not configured.',
      },
    };
  }
  const res = await fetch(`${API_BASE}/api/marquee/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Marquee-Token': TOKEN,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      jsonrpc: '2.0',
      id: payload?.id ?? null,
      error: {
        code: -32002,
        message: `HTTP ${res.status}: ${text}`,
      },
    };
  }
  return text ? JSON.parse(text) : null;
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return;
  }
  // JSON-RPC notifications (no id) require no stdout response if notifications/initialized
  const isNotification = parsed?.id === undefined || parsed?.id === null;
  try {
    const out = await forwardRpc(parsed);
    if (!isNotification && out) {
      process.stdout.write(`${JSON.stringify(out)}\n`);
    }
  } catch (err: any) {
    if (!isNotification) {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: parsed?.id ?? null,
          error: { code: -32603, message: err?.message || 'Bridge transport error' },
        })}\n`,
      );
    }
  }
});
