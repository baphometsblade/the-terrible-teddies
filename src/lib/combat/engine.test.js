import { describe, expect, it } from 'vitest';
import { nextRandom } from './rng.js';
import {
  applyIntent, combatCard, createMatch, leaksHidden, projectFor, replay, stateHash,
} from './engine.js';

const bear = (id, extra = {}) => ({
  id,
  name: extra.name || `Bear ${id}`,
  attack: extra.attack ?? 4,
  defense: extra.defense ?? 3,
  type: extra.type || 'action',
  cost: extra.cost ?? 1,
  ability: extra.ability || 'none',
  effect: extra.effect || null,
  amount: extra.amount || 0,
  tribe: extra.tribe || null,
  gems: 999,
});

const deck = (id) => Array.from({ length: 10 }, (_, i) => bear(id, { name: `Bear ${id}-${i}` }));

function keepBoth(state) {
  let next = applyIntent(state, { seat: 'a', intent: { type: 'mulligan', toss: [] } });
  expect(next.ok).toBe(true);
  next = applyIntent(next.state, { seat: 'b', intent: { type: 'mulligan', toss: [] } });
  expect(next.ok).toBe(true);
  expect(next.state.phase).toBe('main');
  return next.state;
}

describe('seeded combat', () => {
  it('deals the same board from the same seed and a different one from another', () => {
    const setup = { seed: 7, deckA: deck(1), deckB: deck(2), nameA: 'Ada', nameB: 'Bea', first: 'a' };
    const one = createMatch(setup);
    const two = createMatch(setup);
    expect(stateHash(one)).toBe(stateHash(two));
    expect(one.seats.a.hand.map((c) => c.instanceId)).toEqual(two.seats.a.hand.map((c) => c.instanceId));
    const other = createMatch({ ...setup, seed: 8 });
    expect(stateHash(other)).not.toBe(stateHash(one));
  });

  it('replays to the same hash, and the stream does not depend on the clock', () => {
    const setup = { seed: 11, deckA: deck(3), deckB: deck(4), nameA: 'Ada', nameB: 'Bea', first: 'a' };
    const actions = [
      { seat: 'a', intent: { type: 'mulligan', toss: [] } },
      { seat: 'b', intent: { type: 'mulligan', toss: [] } },
      { seat: 'a', intent: { type: 'end' } },
      { seat: 'b', intent: { type: 'end' } },
    ];
    const first = replay(setup, actions);
    const second = replay(setup, actions);
    expect(first.ok).toBe(true);
    expect(first.hash).toBe(second.hash);
    expect(first.hash).toBe(stateHash(first.state));
    expect(nextRandom(1).value).toBe(nextRandom(1).value);
  });

  it('ignores a gems field on the card', () => {
    const juicy = bear(1, { attack: 2, gems: 50 });
    const slim = combatCard(juicy, 'a-1');
    expect(slim.attack).toBe(2);
    expect(slim.gems).toBeUndefined();
  });

  it('hides the opponent hand and both deck orders', () => {
    const state = createMatch({ seed: 3, deckA: deck(1), deckB: deck(2), nameA: 'Ada', nameB: 'Bea' });
    const view = projectFor(state, 'a');
    expect(view.self.hand).toHaveLength(5);
    expect(view.self.deckCount).toBe(5);
    expect(view.opponent.handCount).toBe(5);
    expect(view.opponent.hand).toBeUndefined();
    expect(view.opponent.deck).toBeUndefined();
    expect(leaksHidden(view)).toBe(false);
    expect(JSON.stringify(view)).not.toContain(state.seats.b.hand[0].instanceId);
    expect(JSON.stringify(view)).not.toContain(state.seats.a.deck[0].instanceId);
  });

  it('refuses a play on the wrong turn and an attack the rules do not allow', () => {
    let state = keepBoth(createMatch({
      seed: 5, deckA: deck(1), deckB: deck(2), nameA: 'Ada', nameB: 'Bea', first: 'a',
    }));
    const theirs = applyIntent(state, { seat: 'b', intent: { type: 'end' } });
    expect(theirs.ok).toBe(false);
    expect(theirs.error).toBe('out_of_turn');
    expect(stateHash(state)).toBe(stateHash(state));
    const card = state.seats.a.hand[0];
    const played = applyIntent(state, { seat: 'a', intent: { type: 'play', instanceId: card.instanceId } });
    expect(played.ok).toBe(true);
    state = played.state;
    const attacker = state.seats.a.field[0];
    const swing = applyIntent(state, {
      seat: 'a',
      intent: { type: 'attack', attackerId: attacker.instanceId, targetId: 'face' },
    });
    expect(swing.ok).toBe(false);
    expect(['sick', 'rush', 'blocked']).toContain(swing.error);
  });

  it('plays a rush creature into a face hit across a full turn cycle', () => {
    const rusher = () => bear(9, { name: 'Quick', ability: 'rush', attack: 30, defense: 1, cost: 1 });
    const setup = {
      seed: 2,
      deckA: Array.from({ length: 10 }, rusher),
      deckB: deck(2),
      nameA: 'Ada',
      nameB: 'Bea',
      first: 'a',
    };
    let state = keepBoth(createMatch(setup));
    const card = state.seats.a.hand.find((c) => c.ability === 'rush');
    const played = applyIntent(state, { seat: 'a', intent: { type: 'play', instanceId: card.instanceId } });
    expect(played.ok).toBe(true);
    const attacker = played.state.seats.a.field[0];
    const face = applyIntent(played.state, {
      seat: 'a',
      intent: { type: 'attack', attackerId: attacker.instanceId, targetId: 'face' },
    });
    expect(face.ok).toBe(false);
    expect(face.error).toBe('rush');
    const ended = applyIntent(played.state, { seat: 'a', intent: { type: 'end' } });
    expect(ended.ok).toBe(true);
    const back = applyIntent(ended.state, { seat: 'b', intent: { type: 'end' } });
    expect(back.ok).toBe(true);
    const ready = back.state.seats.a.field[0];
    const lethal = applyIntent(back.state, {
      seat: 'a',
      intent: { type: 'attack', attackerId: ready.instanceId, targetId: 'face' },
    });
    expect(lethal.ok).toBe(true);
    expect(lethal.state.winner).toBe('a');
    expect(lethal.state.reason).toBe('hp');
  });

  it('a client timeout intent does not end the match', () => {
    const state = keepBoth(createMatch({
      seed: 1, deckA: deck(1), deckB: deck(2), nameA: 'Ada', nameB: 'Bea',
    }));
    const cheated = applyIntent(state, { seat: 'b', intent: { type: 'timeout' } });
    expect(cheated.ok).toBe(false);
    const called = applyIntent(state, { seat: 'a', intent: { type: 'timeout' }, server: true });
    expect(called.ok).toBe(true);
    expect(called.state.winner).toBe('b');
    expect(called.state.reason).toBe('timeout');
  });
});
