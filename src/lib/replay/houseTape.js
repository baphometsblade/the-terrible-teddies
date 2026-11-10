// A house or ghost fight is not dealt by the live engine. This keeps the
// asks that did fit, in deck order, so the engine can still rebuild frames.

import { applyIntent, createMatch } from '../combat/engine.js';
import { cardsFor } from '../pvp/decks.js';
import { packLog } from './codec.js';

let tape = null;

export function beginHouseTape({ kind, seed, deckA, deckB, names, rules }) {
  tape = {
    kind: kind === 'ghost' ? 'ghost' : 'house',
    seed: seed || 1,
    deckA: deckA || [],
    deckB: deckB || [],
    names: names || ['You', 'Them'],
    rules: rules || { id: 'standard', hp: 0, energy: 0, damage: 0 },
    notes: [],
  };
}

export function noteHouse(seat, note) {
  if (!tape || (seat !== 'a' && seat !== 'b') || !note) return;
  tape.notes.push({ s: seat, ...note });
}

export function takeHouseTape() {
  const current = tape;
  tape = null;
  return current;
}

function firstOf(list, cardId) {
  return list.find((card) => card.id === cardId) || null;
}

function keep(state, seat) {
  return applyIntent(state, { seat, intent: { type: 'mulligan', toss: [] } });
}

/** Turn a house tape into a log the engine accepts, or null. */
export function compileTape(raw) {
  if (!raw) return null;
  const deckA = cardsFor(raw.deckA);
  const deckB = cardsFor(raw.deckB);
  if (!deckA || !deckB) return null;
  let state = createMatch({
    seed: raw.seed,
    deckA,
    deckB,
    nameA: raw.names[0],
    nameB: raw.names[1],
    rules: raw.rules,
    first: 'a',
    preserveOrder: true,
  });
  const actions = [];
  const keptA = keep(state, 'a');
  if (!keptA.ok) return null;
  state = keptA.state;
  actions.push({ seat: 'a', intent: { type: 'mulligan', toss: [] } });
  const keptB = keep(state, 'b');
  if (!keptB.ok) return null;
  state = keptB.state;
  actions.push({ seat: 'b', intent: { type: 'mulligan', toss: [] } });

  for (const note of raw.notes) {
    const seat = note.s;
    let intent = null;
    if (note.t === 'end') intent = { type: 'end' };
    else if (note.t === 'play') {
      const card = firstOf(state.seats[seat].hand, note.c);
      if (card) intent = { type: 'play', instanceId: card.instanceId };
    } else if (note.t === 'face') {
      const card = firstOf(state.seats[seat].field, note.c);
      if (card) intent = { type: 'attack', attackerId: card.instanceId, targetId: 'face' };
    } else if (note.t === 'hit') {
      const card = firstOf(state.seats[seat].field, note.c);
      const foe = seat === 'a' ? 'b' : 'a';
      const target = firstOf(state.seats[foe].field, note.g);
      if (card && target) {
        intent = { type: 'attack', attackerId: card.instanceId, targetId: target.instanceId };
      }
    }
    if (!intent) continue;
    const next = applyIntent(state, { seat, intent });
    if (!next.ok) continue;
    state = next.state;
    actions.push({ seat, intent });
  }
  return packLog({
    seed: raw.seed,
    deckA,
    deckB,
    rules: raw.rules,
    first: 'a',
    names: raw.names,
    kind: raw.kind,
    actions,
    preserveOrder: true,
  });
}
