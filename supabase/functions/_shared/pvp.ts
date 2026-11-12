// Pub Brawl HTTP. Clients send intents. This process applies the shared engine
// and commits through the service-role RPCs. verify_jwt is on for the three
// player functions and off for pvp-timeout, which checks PVP_CRON_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import { sameSecret, userIdFromAuth } from "./jwt.ts";
import { createMatch, projectFor, pvpRules, stateHash } from "../../../src/lib/combat/engine.js";
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
  const save = await rpc("pvp_save_of", { p_uid: user });
  const owned = Array.isArray(save?.ownedCards) ? save.ownedCards.map(String) : [];
  const packed = await service.from("pack_owned").select("card_id").eq("user_id", user);
  if (!packed.error) {
    for (const row of packed.data || []) owned.push(String(row.card_id));
  }
  const snap = await service.rpc("open_card_pack");
  const seasons = Array.isArray(snap.data?.seasons) ? snap.data.seasons : [];
  const hasRecord = (save && Array.isArray(save.ownedCards)) || (!packed.error && (packed.data || []).length > 0);
  const collection = hasRecord ? owned : STARTERS;
  const blocked = cards.some((card) => !owns(collection, card) || !inPool(String(card.id), seasons));
  return blocked ? "That deck has a card you cannot field." : null;
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await service.rpc(name, args);
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

async function pairWaiting(night, now) {
  const pairs = await rpc("pvp_claim_pairs", { p_limit: 40 });
  if (!Array.isArray(pairs)) return;
  for (const pair of pairs) await dealPair(pair, night, now);
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
  const loaded = await rpc("pvp_load", { p_match: matchId });
  if (!loaded?.ok) return loaded;
  const players = playersFrom(loaded.players);
  const me = players.find((p) => p.user_id === user);
  if (!me) return { ok: false, error: "player" };
  const ctx = {
    matchId,
    kind: loaded.kind,
    night: loaded.night,
    deadline: loaded.deadline,
    now: Date.now(),
    players,
    deltas: loaded.result || null,
  };
  return { ok: true, matchId, view: decorate(loaded.state, me.seat, ctx), status: loaded.status };
}

export async function handleQueue(user: string, body: Record<string, unknown>) {
  const op = String(body.op || "status");
  if (op === "leave") return rpc("pvp_leave_queue", { p_uid: user });
  if (op === "status") {
    await pairWaiting(nightNow(), Date.now());
    const row = await rpc("pvp_queue_row", { p_uid: user });
    if (row?.match_id) {
      const view = await callerView(user, row.match_id);
      return { ...row, ...view, offerGhost: false };
    }
    const waited = row?.enqueued_at ? Date.now() - new Date(row.enqueued_at).getTime() : 0;
    return { ...row, offerGhost: row?.status === "waiting" && waited >= GHOST_OFFER_MS, waitMs: waited };
  }

  const deck = Array.isArray(body.deck) ? body.deck.map((id) => Number(id)) : [];
  const problem = await fieldable(user, deck);
  if (problem) return { ok: false, error: "deck", message: problem };
  const rating = await rpc("pvp_rating_of", { p_uid: user });
  const name = safeName(body.name, "A rival");
  const queued = await rpc("pvp_enqueue", {
    p_uid: user, p_deck: deck, p_rating: rating || 1000, p_name: name,
  });
  if (!queued?.ok) return queued;
  if (queued.match_id) return { ...queued, ...(await callerView(user, queued.match_id)) };

  const night = nightNow();
  const now = Date.now();
  await pairWaiting(night, now);
  // The pairing lock is try-only, so a join that lost the race looks again
  // once the other stool is in the queue.
  let row = await rpc("pvp_queue_row", { p_uid: user });
  if (row?.status === "waiting") {
    await new Promise((resolve) => setTimeout(resolve, 40));
    await pairWaiting(nightNow(), Date.now());
    row = await rpc("pvp_queue_row", { p_uid: user });
  }
  if (row?.match_id) return { ...row, ...(await callerView(user, row.match_id)), offerGhost: false };
  const waited = row?.enqueued_at ? Date.now() - new Date(row.enqueued_at).getTime() : 0;
  return { ...row, offerGhost: waited >= GHOST_OFFER_MS, waitMs: waited };
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
  if (action.intent?.type !== "heartbeat") {
    const prior = await service
      .from("pvp_actions")
      .select("action_id")
      .eq("match_id", loaded.id)
      .eq("action_id", action.id)
      .maybeSingle();
    if (prior.data) match.applied[action.id] = true;
  }
  const admitted = acceptAction(match, {
    id: action.id,
    seat: me.seat,
    turn: action.turn,
    version: action.version,
    intent: action.intent,
    server: !!action.server,
  }, now, { turnMs, mulliganMs });
  if (!admitted.ok) return admitted;
  if (admitted.idempotent) return callerView(user, loaded.id);
  if (admitted.heartbeat) {
    await rpc("pvp_presence", {
      p_match: loaded.id,
      p_user: user,
      p_expected: loaded.version,
      p_grace: admitted.match.graceUsed,
      p_deadline: new Date(admitted.match.deadline).toISOString(),
    });
    return callerView(user, loaded.id);
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
    for (const seat of ["a", "b"]) {
      const player = players.find((p) => p.seat === seat);
      if (!player) continue;
      await service.from("pvp_views").update({
        payload: decorate(admitted.match.state, seat, { ...ctx, deltas: committed.settled }),
      }).eq("match_id", loaded.id).eq("user_id", player.user_id);
    }
  }
  return {
    ok: true,
    matchId: loaded.id,
    timedOut: !!admitted.timedOut,
    view: decorate(admitted.match.state, me.seat, { ...ctx, deltas: committed.settled || null }),
    settled: committed.settled || null,
  };
}

export async function handleAction(user: string, body: Record<string, unknown>) {
  const matchId = String(body.matchId || "");
  if (!matchId) return { ok: false, error: "missing" };
  const rated = await rpc("pvp_rate", { p_uid: user, p_action: "pvp_action" });
  if (rated === false) return { ok: false, error: "slow" };
  let loaded = await rpc("pvp_load", { p_match: matchId });
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
    return callerView(user, matchId);
  }
  const action = {
    id: String(body.actionId || ""),
    turn: Number(body.turn),
    version: Number(body.version),
    intent: body.intent,
    server: false,
  };
  if (!action.id) return { ok: false, error: "illegal" };
  return commitAction(loaded, user, action, Date.now());
}

export async function handleInvite(user: string, body: Record<string, unknown>) {
  const op = String(body.op || "preview");
  if (op === "preview") return rpc("pvp_invite_get", { p_code: String(body.code || "") });
  const deck = Array.isArray(body.deck) ? body.deck.map((id) => Number(id)) : [];
  const problem = await fieldable(user, deck);
  if (problem) return { ok: false, error: "deck", message: problem };
  const rating = await rpc("pvp_rating_of", { p_uid: user });
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
  return { ok: true, due: list.length, finished, errors };
}

export async function servePvp(req: Request, kind: "queue" | "action" | "invite" | "timeout") {
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
    const user = await userId(req.headers.get("Authorization"));
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
