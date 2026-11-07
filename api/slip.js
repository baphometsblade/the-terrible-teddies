// Shared fight slip. The preview is a wink. The deck never leaves the game.

import { renderSlipPage } from '../src/lib/social/slipPage.js';

const DEFAULT_URL = 'https://wqdrbywcktxgytkyqcco.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZHJieXdja3R4Z3l0a3lxY2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NDk4ODEsImV4cCI6MjEwOTUyNTg4MX0.lAlqB-vxgoIlC3U2wl3T8f_M7Jf3Y7nAqTmCh2Aw8Zw';

async function preview(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
  const response = await fetch(`${url}/rest/v1/rpc/slip_preview`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_id: id }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.username) return null;
  return row;
}

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || '');
  let slip = {};
  try {
    const found = await preview(id);
    if (found) {
      slip = {
        name: found.username,
        rival: found.rival_name,
        won: found.won,
        tier: found.tier,
        taunt: found.taunt,
      };
    }
  } catch {
    // A slip that cannot reach the server still renders a safe page.
  }
  const html = renderSlipPage({ id, ...slip });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(html);
}
