// Pub Brawl HTTP. Clients send intents. This process applies the shared engine
// and commits through the service-role RPCs. verify_jwt is on for the three
// player functions and off for pvp-timeout, which checks PVP_CRON_SECRET.

import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import { sameSecret, userIdFromAuth } from "./jwt.ts";
import { createMatch, projectFor, pvpRules, stateHash } from "../../../src/lib/combat/engine.js";
import { packLog } from "../../../src/lib/replay/codec.js";
import { cardsFor, knownDeck } from "../../../src/lib/pvp/decks.js";
import { BUNDLED_SEASON_IDS } from "../../../src/data/seasonsCatalog.js";
import { acceptAction } from "../../../src/lib/pvp/authority.js";
import {
  GHOST_OFFER_MS, HEARTBEAT_STALE_MS, MULLIGAN_MS, TURN_MS,
} from "../../../src/lib/pvp/timing.js";
import { eventAt } from "../../../src/lib/houseEvents.js";
import { HOUSE_RULES } from "../../../src/lib/houseRules.js";
import { safeName } from "../../../src/lib/social/ladder.js";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const turnMs = Number(Deno.env.get("PVP_TURN_MS") || TURN_MS);
const mulliganMs = Number(Deno.env.get("PVP_MULLIGAN_MS") || MULLIGAN_MS);

const service = createClient(url, serviceKey, { auth: { persistSession: false } });

// Where a request's time goes, sent back as Server-Timing so a client or the
// load harness can see it without the function logs: the isolate's cold
// start on its first request, the caller check, and every database trip.
// A trip is one PostgREST round trip through the API gateway; in production
// that is 70-120 ms whatever the SQL costs, so the count matters as much as
// the time.
// `db` is wall time with at least one trip in flight, so trips sent together
// count once.
type Trace = { db: number; trips: number; inflight: number; since: number };
const traces = new AsyncLocalStorage<Trace>();
const loadedAt = performance.now();
let warm = false;

async function trip<T>(run: () => PromiseLike<T>): Promise<T> {
  const trace = traces.getStore();
  if (trace) {
    if (trace.inflight === 0) trace.since = performance.now();
    trace.inflight += 1;
    trace.trips += 1;
  }
  try {
    return await run();
  } finally {
    if (trace) {
      trace.inflight -= 1;
      if (trace.inflight === 0) trace.db += performance.now() - trace.since;
    }
  }
}

// Work that need not hold up the answer (a finished match's replay). The edge
// runtime keeps the isolate alive for it; elsewhere it simply runs.
function later(work: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
}

const allow = () => {
  const list = [
    Deno.env.get("ALLOWED_ORIGIN"),
    ...(Deno.env.get("DENO_ENV") !== "production"
      ? ["http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8090"]
      : []),
  ].filter(Boolean) as string[];
  return list;
};

function cors(origin: string | null) {
  const list = allow();
  const ok = origin && list.includes(origin) ? origin : (list[0] || "");
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pvp-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "Server-Timing",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function userId(authHeader: string | null) {
  return userIdFromAuth(authHeader, anon, url);
}

const STARTERS = ["1", "2", "3", "4", "5", "6", "30", "31", "40", "41", "42"];

function inPool(id: string, seasons: { card_ids?: string[]; status?: string }[]) {
  let seasonal = BUNDLED_SEASON_IDS.has(id);
  let active = false;
  for (const season of seasons) {
    if (!(season.card_ids || []).map(String).includes(id)) continue;
    seasonal = true;
    if (season.status === "active") active = true;
  }
  return !seasonal || active;
}

function owns(owned: string[], card: { id: string | number; filed?: number | null }) {
  const have = new Set(owned.map(String));
  return have.has(String(card.id)) || (card.filed != null && have.has(String(card.filed)));
}

async function fieldable(user: string, deckIds: number[]) {
  const problem = knownDeck(deckIds);
  if (problem) return problem;
  const cards = cardsFor(deckIds);
  if (!cards) return "That deck has a card the bar does not serve.";
  // Three independent reads: the save, the pack ledger, and the season
  // snapshot. Asked together, they cost one round trip of wall time.
  const [save, packed, snap] = await Promise.all([
    rpc("pvp_save_of", { p_uid: user }),
    trip(() => service.from("pack_owned").select("card_id").eq("user_id", user)),
    trip(() => service.rpc("open_card_pack")),
  ]);
  const owned = Array.isArray(save?.ownedCards) ? save.ownedCards.map(String) : [];
  if (!packed.error) {
    for (const row of packed.data || []) owned.push(String(row.card_id));
  }
  const seasons = Array.isArray(snap.data?.seasons) ? snap.data.seasons : [];
  const hasRecord = (save && Array.isArray(save.ownedCards)) || (!packed.error && (packed.data || []).length > 0);
  const collection = hasRecord ? owned : STARTERS;
  const blocked = cards.some((card) => !owns(collection, card) || !inPool(String(card.id), seasons));
  return blocked ? "That deck has a card you cannot field." : null;
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await trip(() => service.rpc(name, args));
  if (error) return { ok: false, error: "server", message: error.message };
  return data;
}

function nightNow() {
  const live = eventAt(new Date());
  if (!live) return null;
  return {
    id: live.id, name: live.name, xp: live.xp, xpDen: live.xpDen, coins: live.coins, coinsDen: live.coinsDen,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newId() {
  return crypto.randomUUID();
}

function seedOf() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // Postgres integer is signed. The engine masks with >>> 0 either way.
  return (buf[0] & 0x7fffffff) || 1;
}

function ruleFrom(id: string) {
  const found = HOUSE_RULES.find((rule) => rule.id === id);
  return pvpRules(found || HOUSE_RULES[0]);
}

function away(lastSeen: string | null, now: number) {
  if (!lastSeen) return true;
  return now - new Date(lastSeen).getTime() > HEARTBEAT_STALE_MS;
}

function decorate(state, seat, ctx) {
  const view = projectFor(state, seat);
  const foe = seat === "a" ? "b" : "a";
  const me = ctx.players.find((p) => p.seat === seat);
  const them = ctx.players.find((p) => p.seat === foe);
  const now = ctx.now;
  return {
    ...view,
    matchId: ctx.matchId,
    kind: ctx.kind,
    night: ctx.night,
    deadline: ctx.deadline,
    servedAt: now,
    selfAway: me ? away(me.last_seen, now) : false,
    opponentAway: them ? away(them.last_seen, now) : false,
    yourRating: me?.rating ?? null,
    opponentRating: them?.rating ?? null,
    deltas: ctx.deltas || null,
    yourDelta: yourDelta(seat, ctx),
  };
}

function yourDelta(seat, ctx) {
  const settled = ctx.deltas;
  if (!settled) return null;
  const me = ctx.players.find((p) => p.seat === seat);
  if (!me) return null;
  if (settled.winner_id === me.user_id) return settled.winner_delta;
  if (settled.loser_id === me.user_id) return settled.loser_delta;
  return null;
}

function viewRows(state, ctx) {
  return ["a", "b"].map((seat) => {
    const player = ctx.players.find((p) => p.seat === seat);
    return { user_id: player.user_id, payload: decorate(state, seat, ctx) };
  });
}

function playersFrom(rows) {
  return (rows || []).map((row) => ({
    user_id: row.user_id,
    seat: row.seat,
    rating: row.rating,
    name: row.name || row.display_name,
    last_seen: row.last_seen || new Date().toISOString(),
  }));
}

async function openBuilt(fn: string, body: Record<string, unknown>) {
  return rpc(fn, { p_body: body });
}

function buildBody({ id, kind, token, seed, setup, state, night, gangId, invite, players, now }) {
  const deadline = new Date(now + (state.phase === "mulligan" ? mulliganMs : turnMs)).toISOString();
  const ctx = {
    matchId: id, kind, night, deadline, now, players, deltas: null,
  };
  return {
    id,
    token: token || null,
    kind,
    seed,
    state,
    setup,
    rules: setup.rules,
    night,
    hash: stateHash(state),
    deadline,
    gang_id: gangId || null,
    invite_code: invite || null,
    players: players.map((p) => ({
      user_id: p.user_id, seat: p.seat, rating: p.rating, name: p.name,
    })),
    views: viewRows(state, ctx),
  };
}

const DEAL_BATCH = 6;

async function pairWaiting(night, now) {
  const pairs = await rpc("pvp_claim_pairs", { p_limit: 40 });
  if (!Array.isArray(pairs)) return 0;
  // Each claimed pair carries its own token, so pairs open independently. A
  // burst of joins can hand one caller dozens of pairs; dealing them a few at
  // a time keeps that caller (and everyone it seated) from waiting on a queue
  // of serial trips, without flooding the pooler.
  for (let i = 0; i < pairs.length; i += DEAL_BATCH) {
    const dealt = await Promise.allSettled(pairs.slice(i, i + DEAL_BATCH).map((pair) => dealPair(pair, night, now)));
    // A failed deal leaves its claim to expire back into the queue, as before;
    // it must not strand the other pairs in the batch.
    for (const result of dealt) if (result.status === "rejected") console.error("pvp deal failed", result.reason);
  }
  return pairs.length;
}

async function dealPair(pair, night, now) {
  const deckA = cardsFor(pair.a.deck);
  const deckB = cardsFor(pair.b.deck);
  if (!deckA || !deckB) {
    await rpc("pvp_release_claim", { p_token: pair.token });
    return { ok: false, error: "deck" };
  }
  const seed = seedOf();
  const first = String(pair.a.enqueued_at) <= String(pair.b.enqueued_at) ? "a" : "b";
  const rules = pvpRules(null);
  const setup = {
    seed, deckA, deckB, nameA: pair.a.name, nameB: pair.b.name, rules, first,
  };
  const state = createMatch(setup);
  const id = newId();
  const players = [
    { user_id: pair.a.user_id, seat: "a", rating: pair.a.rating, name: pair.a.name, last_seen: new Date(now).toISOString() },
    { user_id: pair.b.user_id, seat: "b", rating: pair.b.rating, name: pair.b.name, last_seen: new Date(now).toISOString() },
  ];
  const opened = await openBuilt("pvp_open_match", buildBody({
    id, kind: "ladder", token: pair.token, seed, setup, state, night, gangId: null, invite: null, players, now,
  }));
  if (!opened?.ok) {
    console.error("pvp open failed", opened);
    await rpc("pvp_release_claim", { p_token: pair.token });
  }
  return opened;
}

async function callerView(user: string, matchId: string) {
  return viewOf(await rpc("pvp_load", { p_match: matchId }), user);
}

/**
 * The caller's view of a match already loaded in this request, so a sync, a
 * heartbeat or a retried move does not load it a second time. `patch` carries
 * what the request itself just changed (a heartbeat's deadline and presence).
 */
function viewOf(loaded, user: string, patch: { deadline?: string; seenAt?: string } = {}) {
  if (!loaded?.ok) return loaded;
  const players = playersFrom(loaded.players).map((p) => (
    patch.seenAt && p.user_id === user ? { ...p, last_seen: patch.seenAt } : p
  ));
  const me = players.find((p) => p.user_id === user);
  if (!me) return { ok: false, error: "player" };
  const ctx = {
    matchId: loaded.id,
    kind: loaded.kind,
    night: loaded.night,
    deadline: patch.deadline ?? loaded.deadline,
    now: Date.now(),
    players,
    deltas: loaded.result || null,
  };
  return { ok: true, matchId: loaded.id, view: decorate(loaded.state, me.seat, ctx), status: loaded.status };
}

/** A queue row from pvp_queue_peek, with the caller's view once matched. */
function queueAnswer(user: string, peek) {
  if (!peek || peek.ok === false) return peek;
  const { match, ...row } = peek;
  if (row.match_id) {
    const view = match ? viewOf(match, user) : null;
    if (view?.ok) return { ...row, ...view, offerGhost: false };
  }
  const waited = row.enqueued_at ? Date.now() - new Date(row.enqueued_at).getTime() : 0;
  return { ...row, offerGhost: row.status === "waiting" && waited >= GHOST_OFFER_MS, waitMs: waited };
}

export async function handleQueue(user: string, body: Record<string, unknown>) {
  const op = String(body.op || "status");
  if (op === "leave") return rpc("pvp_leave_queue", { p_uid: user });
  if (op === "status") {
    // Look first: a stool already matched (by a rival's join, or the clock's
    // sweep) costs one trip. Only a waiting one runs the matchmaker, and only
    // reads its row again if the matchmaker dealt someone.
    let peek = await rpc("pvp_queue_peek", { p_uid: user });
    if (peek?.status === "waiting" && await pairWaiting(nightNow(), Date.now()) > 0) {
      peek = await rpc("pvp_queue_peek", { p_uid: user });
    }
    return queueAnswer(user, peek);
  }

  const deck = Array.isArray(body.deck) ? body.deck.map((id) => Number(id)) : [];
  const [problem, rating] = await Promise.all([
    fieldable(user, deck),
    rpc("pvp_rating_of", { p_uid: user }),
  ]);
  if (problem) return { ok: false, error: "deck", message: problem };
  const name = safeName(body.name, "A rival");
  const queued = await rpc("pvp_enqueue", {
    p_uid: user, p_deck: deck, p_rating: rating || 1000, p_name: name,
  });
  if (!queued?.ok) return queued;
  if (queued.match_id) return { ...queued, ...(await callerView(user, queued.match_id)) };

  await pairWaiting(nightNow(), Date.now());
  // The pairing lock is try-only, so a join that lost the race looks again
  // once the other stool is in the queue.
  let peek = await rpc("pvp_queue_peek", { p_uid: user });
  if (peek?.status === "waiting") {
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (await pairWaiting(nightNow(), Date.now()) > 0) peek = await rpc("pvp_queue_peek", { p_uid: user });
  }
  return queueAnswer(user, peek);
}

function seatOf(loaded, user: string) {
  const players = playersFrom(loaded.players);
  return { players, me: players.find((p) => p.user_id === user) };
}

async function commitAction(loaded, user: string, action, now: number) {
  const { players, me } = seatOf(loaded, user);
  if (!me) return { ok: false, error: "player" };
  const seen = { a: now, b: now };
  for (const player of players) {
    seen[player.seat] = player.last_seen ? new Date(player.last_seen).getTime() : now;
  }
  const match = {
    status: loaded.status,
    state: loaded.state,
    deadline: loaded.deadline ? new Date(loaded.deadline).getTime() : now + turnMs,
    graceUsed: !!loaded.grace_used,
    seen,
    applied: {},
  };
  // pvp_turn_open answered whether this action id is already on the match
  // (a retried request), in the same trip that loaded it.
  if (action.intent?.type !== "heartbeat" && loaded.applied) match.applied[action.id] = true;
  const admitted = acceptAction(match, {
    id: action.id,
    seat: me.seat,
    turn: action.turn,
    version: action.version,
    intent: action.intent,
    server: !!action.server,
  }, now, { turnMs, mulliganMs });
  if (!admitted.ok) return admitted;
  // A retried move: the match as loaded already carries it.
  if (admitted.idempotent) return viewOf(loaded, user);
  if (admitted.heartbeat) {
    const deadline = new Date(admitted.match.deadline).toISOString();
    const presence = await rpc("pvp_presence", {
      p_match: loaded.id,
      p_user: user,
      p_expected: loaded.version,
      p_grace: admitted.match.graceUsed,
      p_deadline: deadline,
    });
    // The state did not move, only the clock and this seat's presence, so the
    // view is built from what was loaded. If the match moved underneath
    // (the deadline was not extended) the stored deadline still stands.
    return viewOf(loaded, user, {
      deadline: presence?.extended ? deadline : loaded.deadline,
      seenAt: new Date(now).toISOString(),
    });
  }
  const ctx = {
    matchId: loaded.id,
    kind: loaded.kind,
    night: loaded.night,
    deadline: new Date(admitted.match.deadline).toISOString(),
    now,
    players,
    deltas: null,
  };
  // A timeout is applied for the seat whose clock ran out. The request that
  // noticed it may be the other player. Replay has to wear the right seat.
  const timedSeat = loaded.state.phase === "mulligan" ? "a" : loaded.state.turn;
  const actorId = admitted.timedOut
    ? (players.find((p) => p.seat === timedSeat)?.user_id || user)
    : user;
  const committed = await rpc("pvp_commit", {
    p_body: {
      match_id: loaded.id,
      user_id: actorId,
      action_id: action.id,
      expected: loaded.version,
      intent: admitted.timedOut ? { type: "timeout" } : action.intent,
      turn: loaded.state.turnNumber,
      state: admitted.match.state,
      status: admitted.match.status,
      winner_seat: admitted.match.state.winner || "",
      reason: admitted.match.state.reason || "",
      hash: stateHash(admitted.match.state),
      deadline: ctx.deadline,
      grace_used: admitted.match.graceUsed,
      views: viewRows(admitted.match.state, ctx),
    },
  });
  if (committed?.error === "stale") return { ok: false, error: "stale", version: committed.version };
  if (!committed?.ok) return committed;
  if (committed.settled) {
    await Promise.all(["a", "b"].map((seat) => {
      const player = players.find((p) => p.seat === seat);
      if (!player) return null;
      return trip(() => service.from("pvp_views").update({
        payload: decorate(admitted.match.state, seat, { ...ctx, deltas: committed.settled }),
      }).eq("match_id", loaded.id).eq("user_id", player.user_id));
    }));
  }
  if (admitted.match.status === "finished") {
    // The replay reads the whole action list back and stores the packed log.
    // Nobody waits on it, so it runs after the answer.
    const saving = savePvpReplay(loaded, players).catch((err) => console.error("replay", err));
    later(saving);
  }
  return {
    ok: true,
    matchId: loaded.id,
    timedOut: !!admitted.timedOut,
    view: decorate(admitted.match.state, me.seat, { ...ctx, deltas: committed.settled || null }),
    settled: committed.settled || null,
  };
}

async function savePvpReplay(loaded, players) {
  const { data, error } = await trip(() => service.from("pvp_actions")
    .select("intent, user_id, version")
    .eq("match_id", loaded.id)
    .order("version", { ascending: true }));
  if (error || !loaded.setup) return;
  const seatOf = new Map(players.map((p) => [p.user_id, p.seat]));
  const actions = (data || []).map((row) => ({
    seat: seatOf.get(row.user_id) || "a",
    intent: row.intent,
    server: row.intent?.type === "timeout",
  }));
  const setup = loaded.setup;
  const log = packLog({
    seed: setup.seed,
    deckA: setup.deckA,
    deckB: setup.deckB,
    rules: setup.rules,
    first: setup.first,
    names: [setup.nameA, setup.nameB],
    kind: "pvp",
    actions,
  });
  if (!log) return;
  const owner = players.find((p) => p.seat === "a");
  const other = players.find((p) => p.seat === "b");
  await rpc("replay_put", {
    p_owner: owner?.user_id,
    p_opponent: other?.user_id,
    p_match: loaded.id,
    p_log: log,
  });
}

export async function handleAction(user: string, body: Record<string, unknown>) {
  const matchId = String(body.matchId || "");
  if (!matchId) return { ok: false, error: "missing" };
  const actionId = body.op === "sync" ? "" : String(body.actionId || "");
  if (body.op !== "sync" && !actionId) return { ok: false, error: "illegal" };
  if (!UUID.test(matchId) || (actionId && !UUID.test(actionId))) return { ok: false, error: "missing" };
  // One trip: the rate budget, the match, and whether this action id is
  // already on it.
  const loaded = await rpc("pvp_turn_open", { p_uid: user, p_match: matchId, p_action: actionId || null });
  if (!loaded?.ok) return loaded;
  if (body.op === "sync") {
    const now = Date.now();
    if (loaded.status === "active" && loaded.deadline && new Date(loaded.deadline).getTime() <= now) {
      const { me } = seatOf(loaded, user);
      if (me) {
        const swept = await commitAction(loaded, user, {
          id: newId(), seat: me.seat, turn: loaded.state.turnNumber, version: loaded.version,
          intent: { type: "heartbeat" }, server: false,
        }, now);
        if (swept?.view) return swept;
      }
    }
    return viewOf(loaded, user);
  }
  const action = {
    id: actionId,
    turn: Number(body.turn),
    version: Number(body.version),
    intent: body.intent,
    server: false,
  };
  return commitAction(loaded, user, action, Date.now());
}

export async function handleInvite(user: string, body: Record<string, unknown>) {
  const op = String(body.op || "preview");
  if (op === "preview") return rpc("pvp_invite_get", { p_code: String(body.code || "") });
  const deck = Array.isArray(body.deck) ? body.deck.map((id) => Number(id)) : [];
  const [problem, rating] = await Promise.all([
    fieldable(user, deck),
    rpc("pvp_rating_of", { p_uid: user }),
  ]);
  if (problem) return { ok: false, error: "deck", message: problem };
  const name = safeName(body.name, "A rival");
  if (op === "create") {
    const kind = body.kind === "gang" ? "gang" : "friend";
    return rpc("pvp_invite_create", {
      p_body: { user_id: user, deck, rating: rating || 1000, name, kind, rules: ruleFrom(String(body.rule || "standard")) },
    });
  }
  if (op !== "accept") return { ok: false, error: "illegal" };
  const invite = await rpc("pvp_invite_get", { p_code: String(body.code || "") });
  if (!invite?.ok) return invite;
  if (invite.host_id === user) return { ok: false, error: "self" };
  if (invite.kind === "gang") {
    const gang = await rpc("pvp_gang_of", { p_uid: user });
    if (!gang || gang !== invite.gang_id) return { ok: false, error: "gang" };
  }
  const deckA = cardsFor(invite.deck);
  const deckB = cardsFor(deck);
  if (!deckA || !deckB) return { ok: false, error: "deck" };
  const seed = seedOf();
  const rules = pvpRules(invite.rules);
  const setup = {
    seed, deckA, deckB, nameA: invite.name, nameB: name, rules, first: "a",
  };
  const state = createMatch(setup);
  const id = newId();
  const now = Date.now();
  const players = [
    { user_id: invite.host_id, seat: "a", rating: invite.rating, name: invite.name, last_seen: new Date(now).toISOString() },
    { user_id: user, seat: "b", rating: rating || 1000, name, last_seen: new Date(now).toISOString() },
  ];
  const opened = await openBuilt("pvp_open_direct", buildBody({
    id, kind: invite.kind, token: null, seed, setup, state, night: nightNow(),
    gangId: invite.gang_id, invite: invite.code, players, now,
  }));
  if (!opened?.ok) return opened;
  await rpc("pvp_invite_fill", { p_code: invite.code, p_match: id });
  return callerView(user, id);
}

export async function handleTimeout(now = Date.now()) {
  // The clock's minute is also the matchmaker's safety net: clients poll the
  // queue slowly now that Realtime brings the match, so stools whose windows
  // widened into each other are paired here even if neither is polling.
  const paired = await pairWaiting(nightNow(), now).catch((err) => {
    console.error("pvp pair sweep", err);
    return 0;
  });
  const ids = await rpc("pvp_due", { p_limit: 100 });
  const list = Array.isArray(ids) ? ids : [];
  let finished = 0;
  let errors = 0;
  for (const id of list) {
    const loaded = await rpc("pvp_load", { p_match: id });
    if (!loaded?.ok || loaded.status !== "active") continue;
    const seat = loaded.state.phase === "mulligan" ? "a" : loaded.state.turn;
    const player = playersFrom(loaded.players).find((p) => p.seat === seat) || playersFrom(loaded.players)[0];
    if (!player) { errors += 1; continue; }
    const result = await commitAction(loaded, player.user_id, {
      id: newId(),
      turn: loaded.state.turnNumber,
      version: loaded.version,
      intent: { type: "heartbeat" },
      server: false,
    }, now);
    // Heartbeats do not time a match out by themselves when the actor is the
    // one calling. Force the server timeout through acceptAction's sweep by
    // sending the move after the deadline, which sweep converts.
    if (result?.view?.phase === "over" || result?.timedOut) finished += 1;
    else {
      const forced = await commitAction(loaded, player.user_id, {
        id: newId(),
        turn: loaded.state.turnNumber,
        version: loaded.version,
        intent: { type: "end" },
        server: false,
      }, now);
      if (forced?.view?.reason === "timeout" || forced?.timedOut) finished += 1;
      else errors += 1;
    }
  }
  return { ok: true, due: list.length, finished, errors, paired };
}

export function servePvp(req: Request, kind: "queue" | "action" | "invite" | "timeout") {
  const trace: Trace = { db: 0, trips: 0, inflight: 0, since: 0 };
  return traces.run(trace, async () => {
    const started = performance.now();
    // The isolate's first request carries its cold start: module load to now.
    const cold = warm ? null : started - loadedAt;
    warm = true;
    const auth = { ms: 0 };
    const response = await answer(req, kind, auth);
    const total = performance.now() - started;
    const parts = [
      cold == null ? null : `cold;dur=${cold.toFixed(1)}`,
      `auth;dur=${auth.ms.toFixed(1)}`,
      `db;dur=${trace.db.toFixed(1)};desc="${trace.trips} trips"`,
      `trips;dur=${trace.trips}`,
      `app;dur=${Math.max(0, total - auth.ms - trace.db).toFixed(1)}`,
      `total;dur=${total.toFixed(1)}`,
    ].filter(Boolean);
    response.headers.set("Server-Timing", parts.join(", "));
    return response;
  });
}

async function answer(req: Request, kind: "queue" | "action" | "invite" | "timeout", auth: { ms: number }) {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405, headers);
  try {
    if (kind === "timeout") {
      const secret = Deno.env.get("PVP_CRON_SECRET") || "";
      if (!sameSecret(req.headers.get("x-pvp-cron-secret"), secret)) {
        return json({ ok: false, error: "auth" }, 401, headers);
      }
      return json(await handleTimeout(Date.now()), 200, headers);
    }
    const checking = performance.now();
    const user = await userId(req.headers.get("Authorization"));
    auth.ms = performance.now() - checking;
    if (!user) return json({ ok: false, error: "auth" }, 401, headers);
    const body = await req.json().catch(() => ({}));
    const result = kind === "queue"
      ? await handleQueue(user, body)
      : kind === "action"
        ? await handleAction(user, body)
        : await handleInvite(user, body);
    const status = result?.ok === false && result?.error === "slow" ? 429 : 200;
    return json(result, status, headers);
  } catch (err) {
    console.error("pvp", kind, err);
    return json({ ok: false, error: "server" }, 500, headers);
  }
}
