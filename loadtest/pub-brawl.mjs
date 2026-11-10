#!/usr/bin/env node
// Load test for Pub Brawl. Talks only to a local or explicitly non-production
// Supabase. Refuses the live project (wqdrbywcktxgytkyqcco) even if asked.
//
//   node loadtest/pub-brawl.mjs --players 100 --url http://127.0.0.1:54321
//
// Needs the local stack: `supabase start`, migrations applied, functions served
// with PVP_CRON_SECRET set. SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY
// come from `supabase status`.

import { createClient } from '@supabase/supabase-js';
import { cardsFor } from '../src/lib/pvp/decks.js';
import { createMatch, replay, stateHash } from '../src/lib/combat/engine.js';

const PRODUCTION_REF = 'wqdrbywcktxgytkyqcco';
const DECK = [1, 2, 3, 4, 5, 6, 30, 40, 41, 42];

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const url = arg('url', process.env.SUPABASE_URL || 'http://127.0.0.1:54321');
const anon = arg('anon', process.env.SUPABASE_ANON_KEY || '');
const serviceKey = arg('service', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const players = Number(arg('players', '100'));
const disconnectRate = Number(arg('disconnect', '0.1'));
const idleRate = Number(arg('idle', '0.05'));
const secret = process.env.PVP_CRON_SECRET || 'local-pvp-cron';
const turnHint = Number(process.env.PVP_TURN_MS || 90000);

if (!url || url.includes(PRODUCTION_REF)) {
  console.error('Refusing to load-test the production project.');
  process.exit(2);
}
if (!anon || !serviceKey) {
  console.error('Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from `supabase status`.');
  process.exit(2);
}
if (!cardsFor(DECK)) {
  console.error('The load-test deck is not in the catalog.');
  process.exit(2);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function post(token, name, body) {
  const started = performance.now();
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anon,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ ok: false, error: 'bad-json' }));
  return { ms: performance.now() - started, status: response.status, payload };
}

async function ensureUser(index) {
  const email = `pvp-load-${index}@teddies.test`;
  const password = `Load-${index}-Stool-99`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error && !String(created.error.message).includes('already')) {
    // A rerun finds the user by signing in.
  }
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error(signed.error.message);
  return { email, token: signed.data.session.access_token, id: signed.data.user.id, client };
}

function choose(view) {
  if (!view || view.phase === 'over') return null;
  if (view.phase === 'mulligan' && !view.mulliganDone) return { type: 'mulligan', toss: [] };
  if (view.turn !== view.you) return { type: 'heartbeat' };
  const play = view.legal?.play?.[0];
  if (play) return { type: 'play', instanceId: play };
  const attacker = view.legal?.attackers?.[0];
  if (attacker) {
    const target = attacker.targets.includes('face') ? 'face' : attacker.targets[0];
    if (target) return { type: 'attack', attackerId: attacker.id, targetId: target };
  }
  if (view.legal?.end) return { type: 'end' };
  return { type: 'heartbeat' };
}

async function playOne(user, role) {
  const errors = {};
  const moves = [];
  const waits = [];
  const lags = [];
  const queuedAt = Date.now();
  let joined = await post(user.token, 'pvp-queue', { op: 'join', deck: DECK, name: `Load ${role}` });
  if (!joined.payload?.ok && joined.payload?.error) {
    errors[joined.payload.error] = (errors[joined.payload.error] || 0) + 1;
  }
  let view = joined.payload?.view || null;
  const channel = user.client.channel(`load-${user.id}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'pvp_views', filter: `user_id=eq.${user.id}`,
    }, (payload) => {
      const next = payload?.new?.payload;
      if (!next) return;
      if (next.servedAt) lags.push(Date.now() - next.servedAt);
      view = next;
    })
    .subscribe();

  const deadline = Date.now() + Math.max(turnHint * 8, 20_000);
  let reconnects = 0;
  let reconnectOk = 0;
  let idle = Math.random() < idleRate;
  const dropAt = Math.random() < disconnectRate ? 2 + Math.floor(Math.random() * 3) : -1;
  let movesSent = 0;
  while (Date.now() < deadline) {
    if (!view) {
      const status = await post(user.token, 'pvp-queue', { op: 'status' });
      view = status.payload?.view || null;
      if (view) waits.push(Date.now() - queuedAt);
    }
    if (view?.phase === 'over') break;
    if (idle && view) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(turnHint + 500, 4000)));
      idle = false;
    }
    if (dropAt === movesSent && view?.matchId) {
      reconnects += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      const back = await post(user.token, 'pvp-action', { op: 'sync', matchId: view.matchId });
      if (back.payload?.view) {
        reconnectOk += 1;
        view = back.payload.view;
      } else errors.reconnect = (errors.reconnect || 0) + 1;
    }
    const intent = choose(view);
    if (!view?.matchId || !intent) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      continue;
    }
    if (intent.type === 'heartbeat') {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const sync = await post(user.token, 'pvp-action', { op: 'sync', matchId: view.matchId });
      if (sync.payload?.view) view = sync.payload.view;
      continue;
    }
    const sent = await post(user.token, 'pvp-action', {
      op: 'act',
      matchId: view.matchId,
      actionId: crypto.randomUUID(),
      turn: view.turnNumber,
      version: view.version,
      intent,
    });
    moves.push(sent.ms);
    movesSent += 1;
    if (sent.payload?.view) view = sent.payload.view;
    else if (sent.payload?.error && sent.payload.error !== 'out_of_turn' && sent.payload.error !== 'stale') {
      errors[sent.payload.error] = (errors[sent.payload.error] || 0) + 1;
    }
    if (view?.phase === 'over') break;
  }
  await user.client.removeChannel(channel);
  return {
    errors,
    moves,
    waits,
    lags,
    reconnects,
    reconnectOk,
    over: view?.phase === 'over',
    matchId: view?.matchId || null,
    reason: view?.reason || null,
  };
}

async function tick() {
  await fetch(`${url}/functions/v1/pvp-timeout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pvp-cron-secret': secret, apikey: anon },
    body: '{}',
  }).catch(() => {});
}

async function diverged() {
  const { data, error } = await admin.from('pvp_matches').select('id, setup, state, state_hash').eq('status', 'finished');
  if (error) return { error: error.message, checked: 0, bad: 0 };
  let bad = 0;
  for (const row of data || []) {
    const { data: actions } = await admin.from('pvp_actions')
      .select('intent, user_id, created_at')
      .eq('match_id', row.id)
      .order('version', { ascending: true })
      .order('created_at', { ascending: true });
    const players = await admin.from('pvp_players').select('user_id, seat').eq('match_id', row.id);
    const seatOf = new Map((players.data || []).map((p) => [p.user_id, p.seat]));
    const script = (actions || []).map((action) => ({
      seat: seatOf.get(action.user_id),
      intent: action.intent,
      server: action.intent?.type === 'timeout',
    }));
    const played = replay(row.setup, script);
    if (!played.ok || played.hash !== row.state_hash || played.hash !== stateHash(row.state)) bad += 1;
  }
  return { checked: (data || []).length, bad };
}

async function locks() {
  const { data, error } = await admin.rpc('pvp_due', { p_limit: 1 });
  return { dueProbe: error ? error.message : 'ok', sample: data };
}

const users = [];
console.log(`signing in ${players} players against ${url}`);
for (let i = 0; i < players; i += 1) {
  users.push(await ensureUser(i));
  if (i % 25 === 0) process.stdout.write(`  users ${i}\n`);
}

const ticker = setInterval(tick, 500);
const started = Date.now();
const results = await Promise.all(users.map((user, index) => playOne(user, index).catch((err) => ({
  errors: { throw: 1, [err.message]: 1 }, moves: [], waits: [], lags: [], reconnects: 0, reconnectOk: 0, over: false,
}))));
clearInterval(ticker);
await tick();

const moves = results.flatMap((row) => row.moves);
const waits = results.flatMap((row) => row.waits);
const lags = results.flatMap((row) => row.lags);
const errors = {};
for (const row of results) {
  for (const [key, count] of Object.entries(row.errors)) errors[key] = (errors[key] || 0) + count;
}
const reconnects = results.reduce((sum, row) => sum + row.reconnects, 0);
const reconnectOk = results.reduce((sum, row) => sum + row.reconnectOk, 0);
const completed = results.filter((row) => row.over).length;
const reasons = {};
for (const row of results) if (row.reason) reasons[row.reason] = (reasons[row.reason] || 0) + 1;
const audit = await diverged();

const report = {
  players,
  elapsedMs: Date.now() - started,
  completed,
  errors,
  reasons,
  moveMs: { p50: percentile(moves, 50), p95: percentile(moves, 95), p99: percentile(moves, 99), n: moves.length },
  queueMs: { p50: percentile(waits, 50), p95: percentile(waits, 95), p99: percentile(waits, 99), n: waits.length },
  realtimeLagMs: { p50: percentile(lags, 50), p95: percentile(lags, 95), p99: percentile(lags, 99), n: lags.length },
  reconnects: { attempts: reconnects, ok: reconnectOk, rate: reconnects ? reconnectOk / reconnects : null },
  divergence: audit,
  locks: await locks(),
};
console.log(JSON.stringify(report, null, 2));
process.exit(audit.bad ? 1 : 0);
