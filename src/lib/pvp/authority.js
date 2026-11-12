// Move admission. The edge function calls this and then persists the result.
// It is the check for illegal moves, the wrong turn, a stale version, and a
// replay of an action id. The combat rules themselves stay in the engine.

import { applyIntent } from '../combat/engine.js';
import {
  HEARTBEAT_STALE_MS, MULLIGAN_MS, RECONNECT_GRACE_MS, TURN_MS,
} from './timing.js';

const OTHER = { a: 'b', b: 'a' };

/**
 * @param {object} match status, state, deadline (ms), graceUsed, seen {a,b}, applied { [actionId]: true }
 * @param {object} action id, seat, turn, version, intent, server
 * @param {number} now epoch ms
 */
export function acceptAction(match, action, now, opts = {}) {
  const turnMs = opts.turnMs || TURN_MS;
  const graceMs = opts.graceMs || RECONNECT_GRACE_MS;
  const staleMs = opts.staleMs || HEARTBEAT_STALE_MS;
  const mulliganMs = opts.mulliganMs || MULLIGAN_MS;
  if (!action || !action.id) return { ok: false, error: 'illegal' };
  if (match.applied && match.applied[action.id]) {
    return { ok: true, idempotent: true, match };
  }
  if (!match.state || match.status !== 'active') return { ok: false, error: 'closed' };
  const seat = action.seat;
  if (seat !== 'a' && seat !== 'b') return { ok: false, error: 'illegal' };

  const swept = sweep(match, now, { graceMs, staleMs, turnMs, mulliganMs });
  if (swept.timedOut) {
    const applied = { ...match.applied, [action.id]: true };
    return { ok: true, timedOut: true, match: { ...swept.match, applied } };
  }
  const live = swept.match;
  if (action.version !== live.state.version) return { ok: false, error: 'stale' };
  const type = action.intent && action.intent.type;
  const offTurn = type === 'emote' || type === 'forfeit' || type === 'heartbeat' || type === 'mulligan';
  if (!offTurn && action.turn !== live.state.turnNumber) return { ok: false, error: 'out_of_turn' };
  if (type === 'heartbeat') {
    const seen = { ...live.seen, [seat]: now };
    return {
      ok: true,
      heartbeat: true,
      match: { ...live, seen, applied: { ...live.applied, [action.id]: true } },
    };
  }
  const result = applyIntent(live.state, {
    seat,
    intent: action.intent,
    server: !!action.server,
  });
  if (!result.ok) return { ok: false, error: result.error };
  const deadline = result.turnStarted
    ? now + turnMs
    : live.deadline;
  return {
    ok: true,
    over: result.over,
    match: {
      ...live,
      state: result.state,
      status: result.over ? 'finished' : 'active',
      deadline,
      applied: { ...live.applied, [action.id]: true },
      seen: { ...live.seen, [seat]: now },
    },
  };
}

/** Disconnect grace, then a lazy timeout if the clock has actually run out. */
export function sweep(match, now, opts = {}) {
  const graceMs = opts.graceMs || RECONNECT_GRACE_MS;
  const staleMs = opts.staleMs || HEARTBEAT_STALE_MS;
  const turnMs = opts.turnMs || TURN_MS;
  if (!match.state || match.status !== 'active' || match.state.phase === 'over') {
    return { match, timedOut: false };
  }
  let graceUsed = !!match.graceUsed;
  let deadline = match.deadline;
  const seat = match.state.phase === 'mulligan' ? null : match.state.turn;
  const away = seat && match.seen && (now - (match.seen[seat] || 0) > staleMs);
  if (away && !graceUsed && now < deadline) {
    graceUsed = true;
    deadline += graceMs;
  }
  const next = { ...match, graceUsed, deadline };
  if (now < deadline) return { match: next, timedOut: false };
  const actor = match.state.phase === 'mulligan' ? 'a' : match.state.turn;
  const result = applyIntent(match.state, {
    seat: actor,
    intent: { type: 'timeout' },
    server: true,
  });
  if (!result.ok) return { match: next, timedOut: false };
  const started = result.turnStarted;
  return {
    timedOut: true,
    match: {
      ...next,
      state: result.state,
      status: result.over ? 'finished' : 'active',
      deadline: started ? now + turnMs : deadline,
      reason: result.state.reason,
    },
  };
}

export function freshMatch(state, now, opts = {}) {
  const mulligan = state.phase === 'mulligan';
  const window = mulligan ? (opts.mulliganMs || MULLIGAN_MS) : (opts.turnMs || TURN_MS);
  return {
    status: 'active',
    state,
    deadline: now + window,
    graceUsed: false,
    seen: { a: now, b: now },
    applied: {},
  };
}

export function opponentOf(seat) {
  return OTHER[seat] || null;
}
