#!/usr/bin/env node
// Load test for Pub Brawl. Talks to a local or non-production Supabase by
// default, and refuses the live project (wqdrbywcktxgytkyqcco) unless the run
// is deliberate on both counts: `--production` on the command line AND
// PUB_BRAWL_PRODUCTION=wqdrbywcktxgytkyqcco in the environment. A production
// run never calls pvp-timeout (pg_cron owns the clock there), is capped at 100
// players, and only ever signs in the pvp-load-N@teddies.test accounts, which
// `loadtest/cleanup-prod.sql` removes afterwards.
//
//   node loadtest/pub-brawl.mjs --players 100 --url http://127.0.0.1:54321
//   node loadtest/pub-brawl.mjs --soak 60          # one stool waits alone, then a rival arrives
//
// Seats behave like the browser client: the queue is polled on the client's
// schedule (--queue-poll / --queue-live-poll, defaults from src/lib/pvp/timing.js),
// a seat waiting on its rival listens on Realtime and only syncs on the
// client's in-match schedule, and every edge call is counted, so the report
// carries calls per queued player per minute next to the latencies.
//
// Needs the local stack: `supabase start`, migrations applied, functions served
// with PVP_CRON_SECRET set. SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY
// come from `supabase status`.

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { cardsFor } from '../src/lib/pvp/decks.js';
import { replay, stateHash } from '../src/lib/combat/engine.js';
import * as timing from '../src/lib/pvp/timing.js';
import { functionUrl, pvpRegion } from '../src/lib/pvp/region.js';

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
// Think time before each real move, in ms. 0 is a bot hammering the bar; a
// person takes a second or more. Realtime lag is only meaningful when paced.
const thinkMs = Number(arg('think', '0'));
// Pin edge calls the way the client does (the database region for a hosted
// project). --region any lets the router pick the nearest edge, the old way.
const region = pvpRegion(url, arg('region', undefined));
const secret = process.env.PVP_CRON_SECRET || 'local-pvp-cron';
const turnHint = Number(process.env.PVP_TURN_MS || 90000);
// The client's schedules. A build without the queue constants is the old
// client: a queue poll every POLL_MS whether or not Realtime is up.
const queuePollMs = Number(arg('queue-poll', String(timing.QUEUE_POLL_MS ?? timing.POLL_MS)));
const queueLivePollMs = Number(arg('queue-live-poll', String(timing.QUEUE_LIVE_POLL_MS ?? timing.POLL_MS)));
const syncPollMs = Number(timing.POLL_MS);
const liveSyncMs = Number(timing.LIVE_POLL_MS ?? timing.POLL_MS);
// The old client ran its queue tick on a bare setInterval, so a status call
// went out every tick even while the last one was still in flight. The guarded
// client waits for it. `--queue-overlap` replays the old behaviour.
const queueOverlap = process.argv.includes('--queue-overlap');
const soakSeconds = Number(arg('soak', '0'));
const sessionFile = arg('sessions', '');
const production = process.argv.includes('--production');

if (!url) {
  console.error('Set --url or SUPABASE_URL.');
  process.exit(2);
}
if (url.includes(PRODUCTION_REF) && !(production && process.env.PUB_BRAWL_PRODUCTION === PRODUCTION_REF)) {
  console.error('Refusing to load-test the production project. A deliberate run needs --production and PUB_BRAWL_PRODUCTION set to the project ref.');
  process.exit(2);
}
const live = url.includes(PRODUCTION_REF);
if (live && players > 100) {
  console.error('A production run is capped at 100 players.');
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Every edge call, by function and op, and the function's own Server-Timing
// breakdown when it sends one (cold start, auth, each database trip).
const calls = {};
const serverTiming = {};

function noteTiming(header) {
  if (!header) return;
  for (const part of header.split(',')) {
    const [name, ...params] = part.trim().split(';');
    const dur = params.map((p) => p.trim()).find((p) => p.startsWith('dur='));
    if (!name || !dur) continue;
    (serverTiming[name] ||= []).push(Number(dur.slice(4)));
  }
}

const edgeRegions = {};

async function post(token, name, body) {
  const key = `${name}:${body?.op || 'act'}`;
  calls[key] = (calls[key] || 0) + 1;
  const started = performance.now();
  let response;
  try {
    response = await fetch(functionUrl(url, name, region), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: anon,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ms: performance.now() - started, status: 0, payload: { ok: false, error: 'unreachable' } };
  }
  const ran = response.headers.get('x-sb-edge-region') || 'unknown';
  edgeRegions[ran] = (edgeRegions[ran] || 0) + 1;
  const payload = await response.json().catch(() => ({ ok: false, error: 'bad-json' }));
  if (body?.op === 'act' && body?.intent?.type !== 'heartbeat') noteTiming(response.headers.get('server-timing'));
  return { ms: performance.now() - started, status: response.status, payload };
}

/** Wait up to `ms`, returning early once `ready()` is true (a Realtime push). */
async function waitFor(ms, ready) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (ready()) return true;
    await sleep(Math.min(25, until - Date.now()));
  }
  return ready();
}

// Sessions are kept (mode 0600) between runs when --sessions names a file, so
// a re-run does not spend the auth service's per-address sign-in budget.
const saved = sessionFile && existsSync(sessionFile) ? JSON.parse(readFileSync(sessionFile, 'utf8')) : {};

async function ensureUser(index) {
  const email = `pvp-load-${index}@teddies.test`;
  const password = `Load-${index}-Stool-99`;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const kept = saved[email];
  if (kept?.expiresAt && kept.expiresAt * 1000 > Date.now() + 20 * 60_000) {
    await client.realtime.setAuth(kept.token);
    return { email, token: kept.token, id: kept.id, client };
  }
  if (kept?.refresh) {
    const refreshed = await client.auth.refreshSession({ refresh_token: kept.refresh });
    if (!refreshed.error && refreshed.data.session) return remember(email, client, refreshed.data);
  }
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error && !/already/i.test(String(created.error.message || ''))) {
    throw new Error(created.error.message);
  }
  // The auth service limits sign-ins per address. Wait the window out rather
  // than fail the run; kept sessions mean this is paid once.
  for (let attempt = 0; ; attempt += 1) {
    const signed = await client.auth.signInWithPassword({ email, password });
    if (!signed.error) return remember(email, client, signed.data);
    if (!/rate limit/i.test(signed.error.message) || attempt >= 12) throw new Error(signed.error.message);
    process.stdout.write(`  sign-in limited at ${email}, waiting 30s\n`);
    await sleep(30_000);
  }
}

async function remember(email, client, data) {
  const session = data.session;
  saved[email] = {
    id: data.user.id, token: session.access_token, refresh: session.refresh_token, expiresAt: session.expires_at,
  };
  if (sessionFile) {
    writeFileSync(sessionFile, JSON.stringify(saved), { mode: 0o600 });
    chmodSync(sessionFile, 0o600);
  }
  await client.realtime.setAuth(session.access_token);
  return { email, token: session.access_token, id: data.user.id, client };
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

async function playOne(user, role, { joinAt = 0 } = {}) {
  const errors = {};
  const rejected = {};
  const moves = [];
  const waits = [];
  const lags = [];
  let view = null;
  let matchedBy = null;
  let pushedAt = 0;
  let subscribed = false;
  const channel = user.client.channel(`load-${user.id}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'pvp_views', filter: `user_id=eq.${user.id}`,
    }, (payload) => {
      const next = payload?.new?.payload;
      if (!next) return;
      if (next.servedAt) lags.push(Date.now() - next.servedAt);
      if (!view) matchedBy = matchedBy || 'realtime';
      if (view && next.matchId === view.matchId && Number(next.version) < Number(view.version)) return;
      view = next;
      pushedAt = Date.now();
    })
    .subscribe((status) => { subscribed = status === 'SUBSCRIBED'; });
  // The client opens its socket on mount, before anyone presses Join.
  await waitFor(5_000, () => subscribed);
  if (joinAt > Date.now()) await sleep(joinAt - Date.now());

  const queuedAt = Date.now();
  const joined = await post(user.token, 'pvp-queue', { op: 'join', deck: DECK, name: `Load ${role}` });
  if (!joined.payload?.ok && joined.payload?.error) {
    errors[joined.payload.error] = (errors[joined.payload.error] || 0) + 1;
  }
  const joinedAt = Date.now();
  view = view || joined.payload?.view || null;
  let queueCalls = 1;
  let queuedMs = 0;
  if (view) matchedBy = matchedBy || 'join';
  if (view) waits.push(Date.now() - queuedAt);

  // A full fight of real plays. The server clock stays at its production
  // default (90s) unless PVP_TURN_MS says otherwise. The budget is long
  // enough for that clock, and short enough that a stuck seat is visible.
  const budget = Math.max(turnHint, 90_000) + 60_000 + soakSeconds * 1000;
  const deadline = Date.now() + budget;
  let reconnects = 0;
  let reconnectOk = 0;
  let idle = Math.random() < idleRate;
  const dropAt = Math.random() < disconnectRate ? 2 + Math.floor(Math.random() * 3) : -1;
  let movesSent = 0;
  let lastSync = Date.now();
  while (Date.now() < deadline) {
    if (!view) {
      // The client's queue schedule: a status call every queue tick, slower
      // while the socket is up, and a Realtime push ends the wait at once.
      const pushed = await waitFor(subscribed ? queueLivePollMs : queuePollMs, () => !!view);
      if (!pushed) {
        const call = post(user.token, 'pvp-queue', { op: 'status' }).then((status) => {
          if (!view && status.payload?.view) {
            view = status.payload.view;
            matchedBy = matchedBy || 'poll';
          }
        });
        queueCalls += 1;
        if (!queueOverlap) await call;
      }
      if (view) {
        queuedMs = Date.now() - queuedAt;
        waits.push(queuedMs);
      }
      continue;
    }
    if (!queuedMs) queuedMs = Date.now() - queuedAt;
    if (view?.phase === 'over') break;
    if (idle && view) {
      await sleep(800);
      idle = false;
    }
    if (dropAt === movesSent && view?.matchId) {
      reconnects += 1;
      await sleep(300);
      const back = await post(user.token, 'pvp-action', { op: 'sync', matchId: view.matchId });
      if (back.payload?.view) {
        reconnectOk += 1;
        view = back.payload.view;
      } else errors.reconnect = (errors.reconnect || 0) + 1;
    }
    const intent = choose(view);
    if (!view?.matchId || !intent) {
      await sleep(40);
      continue;
    }
    if (intent.type === 'heartbeat') {
      // Waiting on the rival: the client listens, and syncs only on its own
      // schedule (every LIVE_POLL_MS with the socket up, POLL_MS without).
      const seen = view;
      const every = subscribed ? liveSyncMs : syncPollMs;
      await waitFor(Math.max(0, lastSync + every - Date.now()), () => view !== seen);
      if (view === seen) {
        lastSync = Date.now();
        const sync = await post(user.token, 'pvp-action', { op: 'sync', matchId: view.matchId });
        if (sync.payload?.view) view = sync.payload.view;
      }
      continue;
    }
    if (thinkMs > 0) await sleep(thinkMs * (0.5 + Math.random()));
    const sent = await post(user.token, 'pvp-action', {
      op: 'act',
      matchId: view.matchId,
      actionId: crypto.randomUUID(),
      turn: view.turnNumber,
      version: view.version,
      intent,
    });
    movesSent += 1;
    if (sent.payload?.view) {
      moves.push(sent.ms);
      view = sent.payload.view;
    } else {
      const code = sent.payload?.error;
      if (code === 'out_of_turn' || code === 'stale') {
        // The same as the client: the stool moved, so look again before the
        // next move. Without this a seat whose Realtime push was missed keeps
        // offering the same stale version until its clock runs out.
        rejected[code] = (rejected[code] || 0) + 1;
        const sync = await post(user.token, 'pvp-action', { op: 'sync', matchId: view.matchId });
        if (sync.payload?.view) view = sync.payload.view;
      } else if (code) {
        errors[code] = (errors[code] || 0) + 1;
      }
      await sleep(code === 'slow' ? 1000 : 150);
    }
    if (view?.phase === 'over') break;
  }
  await user.client.removeChannel(channel);
  return {
    errors,
    rejected,
    moves,
    waits,
    lags,
    reconnects,
    reconnectOk,
    queueCalls,
    queuedMs,
    queuedAt,
    joinedAt,
    matchedBy,
    pushedAt,
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

async function diverged(matchIds) {
  const wanted = new Set(matchIds.filter(Boolean));
  const { data, error } = await admin.from('pvp_matches').select('id, setup, state, state_hash').eq('status', 'finished');
  if (error) return { error: error.message, checked: 0, bad: 0 };
  let bad = 0;
  let checked = 0;
  for (const row of data || []) {
    if (wanted.size && !wanted.has(row.id)) continue;
    checked += 1;
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
  return { checked, bad };
}

async function locks() {
  const { data, error } = await admin.rpc('pvp_due', { p_limit: 1 });
  return { dueProbe: error ? error.message : 'ok', sample: data };
}

const seats = soakSeconds > 0 ? 2 : players;
const users = [];
console.log(`signing in ${seats} players against ${live ? 'PRODUCTION' : url}`);
for (let i = 0; i < seats; i += 1) {
  users.push(await ensureUser(i));
  if (i % 25 === 0) process.stdout.write(`  users ${i}\n`);
  // The auth service limits sign-ins per address; a fresh production run
  // paces them instead of tripping it.
  if (live) await sleep(250);
}

// pg_cron owns the clock in production; the harness only sweeps a local stack.
const ticker = live ? null : setInterval(tick, 500);
const started = Date.now();
const failed = (err) => ({
  errors: { throw: 1, [err.message]: 1 }, rejected: {}, moves: [], waits: [], lags: [], reconnects: 0, reconnectOk: 0,
  queueCalls: 0, queuedMs: 0, over: false,
});
const results = soakSeconds > 0
  // One stool waits alone for the soak, then a rival walks in.
  ? await Promise.all([
    playOne(users[0], 0).catch(failed),
    playOne(users[1], 1, { joinAt: Date.now() + soakSeconds * 1000 }).catch(failed),
  ])
  : await Promise.all(users.map((user, index) => playOne(user, index).catch(failed)));
if (ticker) clearInterval(ticker);
if (!live) await tick();

const moves = results.flatMap((row) => row.moves);
const waits = results.flatMap((row) => row.waits);
const lags = results.flatMap((row) => row.lags);
const errors = {};
for (const row of results) {
  for (const [key, count] of Object.entries(row.errors)) errors[key] = (errors[key] || 0) + count;
}
const rejected = {};
for (const row of results) {
  for (const [key, count] of Object.entries(row.rejected || {})) rejected[key] = (rejected[key] || 0) + count;
}
const reconnects = results.reduce((sum, row) => sum + row.reconnects, 0);
const reconnectOk = results.reduce((sum, row) => sum + row.reconnectOk, 0);
const completed = results.filter((row) => row.over).length;
const reasons = {};
for (const row of results) if (row.reason) reasons[row.reason] = (reasons[row.reason] || 0) + 1;
const audit = await diverged(results.map((row) => row.matchId));

// Calls per queued player per minute: every queue call (join and status) a
// seat made, over the minutes seats spent waiting for an opponent.
const queueCalls = results.reduce((sum, row) => sum + (row.queueCalls || 0), 0);
const queuedMinutes = results.reduce((sum, row) => sum + (row.queuedMs || 0), 0) / 60_000;
const timingSummary = Object.fromEntries(Object.entries(serverTiming).map(([name, values]) => [
  name, { p50: percentile(values, 50), p95: percentile(values, 95), n: values.length },
]));
const soak = soakSeconds > 0 ? {
  waitedMs: results[0].queuedMs,
  matchedBy: results[0].matchedBy,
  // How long the waiting stool took to see the match after the rival's join
  // returned: Realtime when it is up, the slow poll when it is not.
  discoveryMs: results[0].queuedAt + results[0].queuedMs - results[1].joinedAt,
  queueCalls: results[0].queueCalls,
  callsPerMinute: results[0].queuedMs ? results[0].queueCalls / (results[0].queuedMs / 60_000) : null,
} : null;

const report = {
  players: seats,
  production: live,
  schedule: { queuePollMs, queueLivePollMs, syncPollMs, liveSyncMs },
  region: region || 'nearest',
  edgeRegions,
  thinkMs,
  elapsedMs: Date.now() - started,
  completed,
  errors,
  rejected,
  reasons,
  moveMs: { p50: percentile(moves, 50), p95: percentile(moves, 95), p99: percentile(moves, 99), n: moves.length },
  queueMs: { p50: percentile(waits, 50), p95: percentile(waits, 95), p99: percentile(waits, 99), n: waits.length },
  realtimeLagMs: { p50: percentile(lags, 50), p95: percentile(lags, 95), p99: percentile(lags, 99), n: lags.length },
  reconnects: { attempts: reconnects, ok: reconnectOk, rate: reconnects ? reconnectOk / reconnects : null },
  calls,
  queue: {
    calls: queueCalls,
    queuedMinutes: Number(queuedMinutes.toFixed(3)),
    callsPerQueuedPlayerMinute: queuedMinutes ? Number((queueCalls / queuedMinutes).toFixed(1)) : null,
  },
  serverTiming: timingSummary,
  soak,
  divergence: audit,
  locks: await locks(),
};
console.log(JSON.stringify(report, null, 2));
process.exit(audit.bad ? 1 : 0);
