// A replay is a few kilobytes of what was asked, not a film of what it looked
// like. The engine deals from the seed and walks the intents.

import { ENGINE_VERSION, framesFrom, replay, stateHash } from '../combat/engine.js';
import { cardsFor } from '../pvp/decks.js';

export const REPLAY_BYTE_BUDGET = 8192;
export { ENGINE_VERSION };

export function packAction(action) {
  const intent = action?.intent || {};
  const row = { s: action.seat, t: intent.type };
  if (action.server) row.server = 1;
  if (intent.instanceId) row.i = intent.instanceId;
  if (intent.attackerId) row.a = intent.attackerId;
  if (intent.targetId) row.g = intent.targetId;
  if (intent.tauntId) row.e = intent.tauntId;
  if (Array.isArray(intent.toss) && intent.toss.length) row.toss = intent.toss;
  return row;
}

export function unpackAction(row) {
  const intent = { type: row.t };
  if (row.i) intent.instanceId = row.i;
  if (row.a) intent.attackerId = row.a;
  if (row.g) intent.targetId = row.g;
  if (row.e) intent.tauntId = row.e;
  if (row.toss) intent.toss = row.toss;
  return { seat: row.s, intent, server: row.server === 1 };
}

export function packLog({
  seed, deckA, deckB, rules, first = 'a', names = ['You', 'Them'], kind = 'pvp',
  actions = [], preserveOrder = false,
}) {
  const setup = {
    v: ENGINE_VERSION,
    seed,
    deckA,
    deckB,
    nameA: names[0],
    nameB: names[1],
    rules,
    first,
    preserveOrder,
  };
  const played = replay(setup, actions);
  if (!played.ok) return null;
  const log = {
    v: ENGINE_VERSION,
    seed,
    a: deckA.map((card) => card.id ?? card),
    b: deckB.map((card) => card.id ?? card),
    rules,
    first,
    names,
    kind,
    order: preserveOrder ? 1 : 0,
    intents: actions.map(packAction),
    hash: played.hash,
  };
  return logBytes(log) <= REPLAY_BYTE_BUDGET ? log : null;
}

export function logBytes(log) {
  return JSON.stringify(log || {}).length;
}

/** Card records for a stored id list. Null when the catalog has moved on. */
export function decksFrom(log) {
  if (!log || log.v !== ENGINE_VERSION) return null;
  const deckA = cardsFor(log.a || []);
  const deckB = cardsFor(log.b || []);
  if (!deckA || !deckB) return null;
  return { deckA, deckB };
}

export function setupFrom(log) {
  const decks = decksFrom(log);
  if (!decks) return null;
  return {
    v: log.v,
    seed: log.seed,
    deckA: decks.deckA,
    deckB: decks.deckB,
    nameA: log.names?.[0] || 'You',
    nameB: log.names?.[1] || 'Them',
    rules: log.rules,
    first: log.first === 'b' ? 'b' : 'a',
    preserveOrder: log.order === 1,
  };
}

export function actionsFrom(log) {
  return (log?.intents || []).map(unpackAction);
}

export function playLog(log) {
  const setup = setupFrom(log);
  if (!setup) return { ok: false, error: log?.v !== ENGINE_VERSION ? 'incompatible' : 'deck' };
  const frames = framesFrom(setup, actionsFrom(log));
  if (!frames.ok) return frames;
  if (log.hash && frames.hash !== log.hash) return { ok: false, error: 'hash', frames: frames.frames };
  return frames;
}

export function witnessedHash(log) {
  const setup = setupFrom(log);
  if (!setup) return '';
  const played = replay(setup, actionsFrom(log));
  return played.ok ? played.hash : '';
}

export { stateHash };
