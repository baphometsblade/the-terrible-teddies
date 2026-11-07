// Shared challenge links. Scrapers do not run the app, so this document is
// what a preview shows: a safe title, the public picture, and a link that
// lands on the age gate. The deck is not in the HTML.

import { renderDuelPage } from '../src/lib/social/duelPage.js';

const DEFAULT_URL = 'https://wqdrbywcktxgytkyqcco.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZHJieXdja3R4Z3l0a3lxY2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NDk4ODEsImV4cCI6MjEwOTUyNTg4MX0.lAlqB-vxgoIlC3U2wl3T8f_M7Jf3Y7nAqTmCh2Aw8Zw';

async function preview(code) {
  if (!/^[0-9a-f]{10}$/i.test(code)) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
  const response = await fetch(`${url}/rest/v1/rpc/challenge_preview`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_code: code.toLowerCase() }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.username) return null;
  return { name: row.username, tier: row.tier || null };
}

export default async function handler(req, res) {
  const code = String((req.query && req.query.code) || '');
  let name = null;
  let tier = null;
  try {
    const found = await preview(code);
    if (found) {
      name = found.name;
      tier = found.tier;
    }
  } catch {
    // A preview that cannot reach the server still says a challenge exists.
  }
  const html = renderDuelPage({ code, name, tier });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(html);
}
