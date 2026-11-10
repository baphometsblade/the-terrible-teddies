import { describe, expect, it } from 'vitest';
import { createMatch, applyIntent, stateHash } from '../combat/engine.js';
import { cardsFor } from '../pvp/decks.js';
import {
  ENGINE_VERSION, REPLAY_BYTE_BUDGET, logBytes, packLog, playLog,
} from './codec.js';
import { compileTape } from './houseTape.js';

const ids = [1, 2, 3, 4, 5, 6, 30, 40, 41, 42];

function scripted(seed, extra = []) {
  const deckA = cardsFor(ids);
  const deckB = cardsFor(ids);
  let state = createMatch({
    seed, deckA, deckB, nameA: 'Ada', nameB: 'Bea', first: 'a',
    rules: { id: 'standard', hp: 0, energy: 0, damage: 0 },
  });
  const actions = [];
  const push = (seat, intent, server = false) => {
    const next = applyIntent(state, { seat, intent, server });
    expect(next.ok, next.error).toBe(true);
    state = next.state;
    actions.push({ seat, intent, server });
  };
  push('a', { type: 'mulligan', toss: [] });
  push('b', { type: 'mulligan', toss: [] });
  const play = (seat) => {
    const card = state.seats[seat].hand.find((row) => row.type === 'action' && row.cost <= state.seats[seat].energy);
    if (!card) return false;
    push(seat, { type: 'play', instanceId: card.instanceId });
    return true;
  };
  play('a');
  push('a', { type: 'end' });
  play('b');
  push('b', { type: 'end' });
  for (const step of extra) step(state, push);
  return { seed, deckA, deckB, actions, state };
}

describe('match replays', () => {
  it('rebuilds the stored final state for many seeds', () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const played = scripted(seed);
      const log = packLog({
        seed, deckA: played.deckA, deckB: played.deckB,
        rules: { id: 'standard', hp: 0, energy: 0, damage: 0 },
        names: ['Ada', 'Bea'], kind: 'pvp', actions: played.actions,
      });
      expect(log, `seed ${seed}`).toBeTruthy();
      expect(log.v).toBe(ENGINE_VERSION);
      const again = playLog(log);
      expect(again.ok, again.error).toBe(true);
      expect(again.hash).toBe(log.hash);
      expect(again.hash).toBe(stateHash(played.state));
      expect(again.frames.length).toBe(played.actions.length + 1);
    }
  });

  it('stays inside a few kilobytes, and flags a foreign engine version', () => {
    const sizes = [];
    for (let seed = 1; seed <= 12; seed += 1) {
      const played = scripted(seed);
      const log = packLog({
        seed, deckA: played.deckA, deckB: played.deckB,
        rules: { id: 'standard', hp: 0, energy: 0, damage: 0 },
        names: ['Ada', 'Bea'], actions: played.actions,
      });
      sizes.push(logBytes(log));
      expect(logBytes(log)).toBeLessThanOrEqual(REPLAY_BYTE_BUDGET);
    }
    const average = Math.round(sizes.reduce((sum, n) => sum + n, 0) / sizes.length);
    expect(average).toBeGreaterThan(80);
    expect(average).toBeLessThan(2500);
    const deckA = cardsFor(ids);
    const deckB = cardsFor(ids);
    const rules = { id: 'standard', hp: 0, energy: 0, damage: 0 };
    let state = createMatch({ seed: 1, deckA, deckB, nameA: 'Ada', nameB: 'Bea', rules, first: 'a' });
    const actions = [];
    const push = (seat, intent) => {
      const next = applyIntent(state, { seat, intent });
      if (!next.ok) return false;
      state = next.state;
      actions.push({ seat, intent });
      return true;
    };
    push('a', { type: 'mulligan', toss: [] });
    push('b', { type: 'mulligan', toss: [] });
    for (let i = 0; i < 80 && state.reason !== 'fatigue'; i += 1) {
      if (!push(state.turn, { type: 'end' })) break;
    }
    const fatigue = packLog({
      seed: 1, deckA, deckB, rules, names: ['Ada', 'Bea'], kind: 'pvp', actions,
    });
    expect(fatigue).toBeTruthy();
    expect(logBytes(fatigue)).toBeLessThan(REPLAY_BYTE_BUDGET);
    expect(playLog(fatigue).hash).toBe(fatigue.hash);
    const foreign = playLog({ v: ENGINE_VERSION + 9, a: ids, b: ids, seed: 1, intents: [] });
    expect(foreign.ok).toBe(false);
    expect(foreign.error).toBe('incompatible');
  });

  it('keeps a house tape that the engine can walk again', () => {
    const log = compileTape({
      kind: 'house',
      seed: 3,
      deckA: ids,
      deckB: ids,
      names: ['Ada', 'Chuck'],
      rules: { id: 'standard', hp: 0, energy: 0, damage: 0 },
      notes: [
        { s: 'a', t: 'play', c: ids[0] },
        { s: 'a', t: 'end' },
      ],
    });
    expect(log).toBeTruthy();
    expect(log.kind).toBe('house');
    const again = playLog(log);
    expect(again.ok).toBe(true);
    expect(again.hash).toBe(log.hash);
  });
});
