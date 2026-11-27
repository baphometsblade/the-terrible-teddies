import { describe, expect, it } from 'vitest';
import { nextRandom } from './rng.js';
import { COMBAT_CATALOG } from './catalog.js';
import { flipCoin } from '../arrivals.js';
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
  ...(extra.interest ? { interest: extra.interest } : {}),
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

  it('a plain play does not flip a coin or touch the other face', () => {
    const state = keepBoth(createMatch({
      seed: 4, deckA: deck(1), deckB: deck(2), nameA: 'Ada', nameB: 'Bea', first: 'a', preserveOrder: true,
    }));
    const rng = state.rng;
    const card = state.seats.a.hand[0];
    const played = applyIntent(state, { seat: 'a', intent: { type: 'play', instanceId: card.instanceId } });
    expect(played.ok).toBe(true);
    expect(played.state.rng).toBe(rng);
    expect(played.state.seats.b.health).toBe(state.seats.b.health);
    expect(played.state.seats.a.field[0].attack).toBe(card.attack);
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

const fillers = (id) => Array.from({ length: 8 }, (_, i) => bear(`${id}-${i}`, {
  name: `Fill ${id}-${i}`, cost: 1, attack: 1, defense: 2,
}));

function deal(deckA, deckB, { seed = 1, first = 'a', rules } = {}) {
  return keepBoth(createMatch({
    seed, deckA, deckB, nameA: 'Ada', nameB: 'Bea', first, preserveOrder: true, rules,
  }));
}

function playNamed(state, seat, pred) {
  const card = state.seats[seat].hand.find(pred);
  expect(card).toBeTruthy();
  const played = applyIntent(state, { seat, intent: { type: 'play', instanceId: card.instanceId } });
  expect(played.ok).toBe(true);
  return played.state;
}

function endTurnNow(state) {
  const ended = applyIntent(state, { seat: state.turn, intent: { type: 'end' } });
  expect(ended.ok).toBe(true);
  return ended.state;
}

function seedFor(want) {
  for (let seed = 1; seed < 80; seed += 1) {
    if (flipCoin(() => nextRandom(seed).value) === want) return seed;
  }
  throw new Error(`no ${want} seed`);
}

function eggnogLands(seed) {
  const coin = nextRandom(nextRandom(seed).state);
  return coin.value >= 0.5;
}

describe('Pub Brawl plays the house arrivals', () => {
  it('keeps trap interest on the way into a fight and leaves everyone else alone', () => {
    const quiet = COMBAT_CATALOG.find((card) => card.id === 'ck-quiet-word');
    expect(combatCard(quiet, 'q').interest).toBe(1);
    expect(combatCard(COMBAT_CATALOG[0], 'n').interest).toBeUndefined();
  });

  it('swaps attack when Secret Santa sits down, and the replay lands on the same board', () => {
    const stan = bear('stan', { name: 'Stan', ability: 'regift', attack: 2, defense: 4, cost: 1 });
    const vic = bear('vic', { name: 'Vic', attack: 5, defense: 4, cost: 1 });
    const deckA = [stan, ...fillers('a')];
    const deckB = [vic, ...fillers('b')];
    let state = deal(deckA, deckB, { first: 'b' });
    state = playNamed(state, 'b', (card) => card.name === 'Vic');
    state = endTurnNow(state);
    state = playNamed(state, 'a', (card) => card.ability === 'regift');
    expect(state.seats.a.field.find((card) => card.name === 'Stan').attack).toBe(5);
    expect(state.seats.b.field.find((card) => card.name === 'Vic').attack).toBe(2);
    expect(state.log.join('\n')).toContain('swapped attack');
    const actions = [
      { seat: 'a', intent: { type: 'mulligan', toss: [] } },
      { seat: 'b', intent: { type: 'mulligan', toss: [] } },
      { seat: 'b', intent: { type: 'play', instanceId: 'b-1' } },
      { seat: 'b', intent: { type: 'end' } },
      { seat: 'a', intent: { type: 'play', instanceId: 'a-1' } },
    ];
    const setup = {
      seed: 1, deckA, deckB, nameA: 'Ada', nameB: 'Bea', first: 'b', preserveOrder: true,
    };
    const once = replay(setup, actions);
    const twice = replay(setup, actions);
    expect(once.ok).toBe(true);
    expect(once.hash).toBe(twice.hash);
    expect(once.hash).toBe(stateHash(state));
  });

  it('trades seats under the mistletoe, and neither bear can swing while kissed', () => {
    const mandy = bear('mandy', { name: 'Mandy', ability: 'mistletoe', attack: 2, defense: 4, cost: 1 });
    const left = bear('left', { name: 'Left', attack: 3, defense: 3, cost: 1 });
    let state = deal([mandy, ...fillers('a')], [left, ...fillers('b')], { first: 'b' });
    state = playNamed(state, 'b', (card) => card.name === 'Left');
    const leftId = state.seats.b.field[0].instanceId;
    const rng = state.rng;
    state = endTurnNow(state);
    state = playNamed(state, 'a', (card) => card.ability === 'mistletoe');
    expect(state.rng).toBe(rng);
    expect(state.seats.a.field.map((card) => card.name)).toEqual(['Left']);
    expect(state.seats.b.field.map((card) => card.name)).toEqual(['Mandy']);
    expect(state.seats.a.field[0].instanceId).toBe(leftId);
    expect(state.seats.a.field[0].kissed).toBe(true);
    expect(state.seats.b.field[0].kissed).toBe(true);
    const swing = applyIntent(state, {
      seat: 'a',
      intent: {
        type: 'attack',
        attackerId: state.seats.a.field[0].instanceId,
        targetId: state.seats.b.field[0].instanceId,
      },
    });
    expect(swing.ok).toBe(false);
    expect(swing.error).toBe('sick');
  });

  it('flips Naughty or Nice from the match seed, and a Naughty sack can end it', () => {
    const list = bear('list', { name: 'The List', ability: 'naughty', attack: 3, defense: 4, cost: 1 });
    const niceSeed = seedFor('nice');
    let nice = deal([list, ...fillers('a')], fillers('b'), { seed: niceSeed });
    nice = playNamed(nice, 'a', (card) => card.ability === 'naughty');
    expect(nice.seats.a.field[0].attack).toBe(5);
    expect(nice.seats.b.health).toBe(30);

    const santa = bear('santa', { name: 'Santa', ability: 'sack', attack: 5, defense: 4, cost: 1 });
    const naughtySeed = seedFor('naughty');
    let ended = deal([santa, ...fillers('a')], fillers('b'), {
      seed: naughtySeed, rules: { id: 'glass', hp: -27 },
    });
    expect(ended.seats.b.health).toBe(3);
    const played = applyIntent(ended, {
      seat: 'a',
      intent: { type: 'play', instanceId: ended.seats.a.hand.find((card) => card.ability === 'sack').instanceId },
    });
    expect(played.ok).toBe(true);
    expect(played.state.phase).toBe('over');
    expect(played.state.winner).toBe('a');
    expect(played.state.reason).toBe('hp');
    expect(played.state.seats.a.stats.damage).toBe(3);
  });

  it('sits an enemy out when the nog lands Naughty, and lets Eddie hit harder when it does not', () => {
    const eddie = bear('eddie', { name: 'Eddie', ability: 'eggnog', attack: 2, defense: 3, cost: 1 });
    const pat = bear('pat', { name: 'Pat', attack: 4, defense: 4, cost: 1 });
    const run = (seed) => {
      let state = deal([eddie, ...fillers('a')], [pat, ...fillers('b')], { seed, first: 'b' });
      state = playNamed(state, 'b', (card) => card.name === 'Pat');
      state = endTurnNow(state);
      state = playNamed(state, 'a', (card) => card.ability === 'eggnog');
      return state;
    };
    let naughtySeed = 0;
    let niceSeed = 0;
    for (let seed = 1; seed < 80 && (!naughtySeed || !niceSeed); seed += 1) {
      if (eggnogLands(seed)) naughtySeed = naughtySeed || seed;
      else niceSeed = niceSeed || seed;
    }
    const sat = run(naughtySeed);
    const patSat = sat.seats.b.field.find((card) => card.name === 'Pat');
    expect(patSat.hungover).toBe(true);
    expect(sat.seats.a.field.find((card) => card.name === 'Eddie').attack).toBe(2);
    const bTurn = endTurnNow(sat);
    expect(bTurn.turn).toBe('b');
    const eddieId = bTurn.seats.a.field.find((card) => card.name === 'Eddie').instanceId;
    const swing = applyIntent(bTurn, {
      seat: 'b',
      intent: { type: 'attack', attackerId: patSat.instanceId, targetId: eddieId },
    });
    expect(swing.ok).toBe(false);
    expect(swing.error).toBe('spent');

    const sipped = run(niceSeed);
    expect(sipped.seats.b.field.find((card) => card.name === 'Pat').hungover).toBe(false);
    expect(sipped.seats.a.field.find((card) => card.name === 'Eddie').attack).toBe(3);
    const niceTurn = endTurnNow(sipped);
    const niceSwing = applyIntent(niceTurn, {
      seat: 'b',
      intent: {
        type: 'attack',
        attackerId: niceTurn.seats.b.field[0].instanceId,
        targetId: niceTurn.seats.a.field[0].instanceId,
      },
    });
    expect(niceSwing.ok).toBe(true);
  });

  it('takes the costume off a Shield that survives Encore', () => {
    const elf = bear('elf', { name: 'Elf', ability: 'strip', attack: 3, defense: 2, cost: 1 });
    const rubber = bear('rubber', { name: 'Rubber', ability: 'shield', attack: 1, defense: 6, cost: 1 });
    let state = deal([elf, ...fillers('a')], [rubber, ...fillers('b')], { first: 'b' });
    state = playNamed(state, 'b', (card) => card.ability === 'shield');
    state = endTurnNow(state);
    state = playNamed(state, 'a', (card) => card.ability === 'strip');
    state = endTurnNow(state);
    state = endTurnNow(state);
    const attacker = state.seats.a.field.find((card) => card.name === 'Elf');
    const target = state.seats.b.field.find((card) => card.name === 'Rubber');
    const hit = applyIntent(state, {
      seat: 'a',
      intent: { type: 'attack', attackerId: attacker.instanceId, targetId: target.instanceId },
    });
    expect(hit.ok).toBe(true);
    expect(hit.state.seats.b.field[0].currentHp).toBe(3);
    expect(hit.state.seats.b.field[0].ability).toBe('none');
  });

  it('collects interest when The Quiet Word springs', () => {
    const word = bear('word', {
      name: 'The Quiet Word', type: 'trap', effect: 'damage', amount: 4, interest: 1, cost: 1, attack: 0, defense: 0,
    });
    const swinger = bear('swing', { name: 'Swinger', attack: 4, defense: 3, cost: 1 });
    let state = deal([swinger, ...fillers('a')], [word, ...fillers('b')], { first: 'b' });
    state = playNamed(state, 'b', (card) => card.type === 'trap');
    expect(state.seats.b.field[0].interest).toBe(1);
    state = endTurnNow(state);
    state = playNamed(state, 'a', (card) => card.name === 'Swinger');
    state = endTurnNow(state);
    state = endTurnNow(state);
    const attacker = state.seats.a.field[0];
    const sprung = applyIntent(state, {
      seat: 'a',
      intent: { type: 'attack', attackerId: attacker.instanceId, targetId: 'face' },
    });
    expect(sprung.ok).toBe(true);
    expect(sprung.state.seats.a.health).toBe(26);
    expect(sprung.state.seats.b.health).toBe(30);
    expect(sprung.state.seats.b.field).toHaveLength(0);
    expect(sprung.state.seats.a.field[0].attack).toBe(3);
    expect(sprung.state.log.join('\n')).toContain('takes 1 off Swinger');
  });

  it('tops a heal while Chuck is on the stool, and tops you up at the end of a tab', () => {
    const chuck = bear('chuck', { name: 'Chuck', ability: 'pour', attack: 1, defense: 5, cost: 1 });
    const plaster = bear('plaster', {
      name: 'Plaster', type: 'special', effect: 'heal', amount: 5, cost: 1, attack: 0, defense: 0,
    });
    const bruiser = bear('bruiser', { name: 'Bruiser', attack: 8, defense: 4, cost: 1 });
    let state = deal([chuck, plaster, ...fillers('a')], [bruiser, ...fillers('b')], { first: 'b' });
    state = playNamed(state, 'b', (card) => card.name === 'Bruiser');
    state = endTurnNow(state);
    state = endTurnNow(state);
    const atk = state.seats.b.field[0];
    const hit = applyIntent(state, {
      seat: 'b',
      intent: { type: 'attack', attackerId: atk.instanceId, targetId: 'face' },
    });
    expect(hit.ok).toBe(true);
    expect(hit.state.seats.a.health).toBe(22);
    state = endTurnNow(hit.state);
    state = playNamed(state, 'a', (card) => card.ability === 'pour');
    state = playNamed(state, 'a', (card) => card.effect === 'heal');
    expect(state.seats.a.health).toBe(29);
    expect(state.seats.a.stats.healing).toBe(7);

    const tabby = bear('tabby', { name: 'Tabitha', ability: 'tab', attack: 1, defense: 3, cost: 1 });
    let tab = deal([tabby, ...fillers('a')], [bruiser, ...fillers('b')], { first: 'b' });
    tab = playNamed(tab, 'b', (card) => card.name === 'Bruiser');
    tab = endTurnNow(tab);
    tab = endTurnNow(tab);
    const tabAtk = tab.seats.b.field[0];
    const poked = applyIntent(tab, {
      seat: 'b',
      intent: { type: 'attack', attackerId: tabAtk.instanceId, targetId: 'face' },
    });
    expect(poked.state.seats.a.health).toBe(22);
    tab = endTurnNow(poked.state);
    tab = playNamed(tab, 'a', (card) => card.ability === 'tab');
    tab = endTurnNow(tab);
    expect(tab.seats.a.health).toBe(23);
    expect(tab.log.join('\n')).toContain('The tab tops Ada up. +1 HP.');
  });
});
