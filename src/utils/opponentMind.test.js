import { describe, expect, it } from 'vitest';
import { planAttackTarget, planOpponentPlays, orderAttackers, mindLine } from './opponentMind';
import { chooseOpponentPlays } from './opponentAI';

const card = (id, cost, attack = 1, defense = 1, extra = {}) => ({
  id, cost, attack, defense, name: `c${id}`, type: 'action', ability: 'none', ...extra,
});

describe('planOpponentPlays', () => {
  const deck = [card(1, 1, 1, 1), card(2, 1, 2, 2), card(3, 4, 5, 5)];

  it('on normal matches the greedy deck-order pass', () => {
    const mind = planOpponentPlays({ difficulty: 'normal', deck, field: [], energy: 2 });
    const greedy = chooseOpponentPlays(deck, 0, 2);
    expect(mind.plays.map((c) => c.id)).toEqual(greedy.plays.map((c) => c.id));
    expect(mind.remainingDeck.map((c) => c.id)).toEqual(greedy.remainingDeck.map((c) => c.id));
  });

  it('on easy spends the turn on one cheap card', () => {
    const mind = planOpponentPlays({ difficulty: 'easy', deck, field: [], energy: 3 });
    expect(mind.plays.map((c) => c.id)).toEqual([1]);
    expect(mind.remainingDeck.map((c) => c.id)).toEqual([2, 3]);
    expect(mind.energyLeft).toBe(2);
  });

  it('on hard answers a crowded table with the taunt, not the top card', () => {
    const taunt = card(6, 3, 2, 4, { ability: 'taunt', name: 'Sally' });
    const runt = card(4, 1, 2, 1);
    const enemy = [card(9, 1, 4, 3, { instanceId: 'e' })];
    const mind = planOpponentPlays({
      difficulty: 'hard', deck: [runt, taunt], field: [], energy: 3, enemyField: enemy,
    });
    expect(mind.plays.map((c) => c.id)).toEqual([6]);
    expect(mind.remainingDeck.map((c) => c.id)).toEqual([4]);
  });

  it('on hard holds a heal when already full, and plays the body', () => {
    const heal = { id: 75, name: 'Hair', type: 'special', cost: 2, effect: 'heal', amount: 5, attack: 0, defense: 0 };
    const body = card(5, 2, 2, 2);
    const mind = planOpponentPlays({
      difficulty: 'hard', deck: [heal, body], field: [], energy: 4, ownHp: 30,
    });
    expect(mind.plays.map((c) => c.id)).toEqual([5]);
  });

  it('on hard plays a Quickie that can kill something on the table', () => {
    const rush = card(96, 2, 2, 1, { ability: 'rush' });
    const vanilla = card(3, 2, 2, 2);
    const enemy = [card(8, 1, 1, 2, { currentHp: 2, instanceId: 'e' })];
    const mind = planOpponentPlays({
      difficulty: 'hard', deck: [vanilla, rush], field: [], energy: 2, enemyField: enemy,
    });
    expect(mind.plays.map((c) => c.id)).toEqual([96]);
  });
});

describe('planAttackTarget', () => {
  const threat = card(2, 1, 6, 5);
  const runt = card(3, 1, 1, 4);

  it('on easy hits the smallest threat', () => {
    const pick = planAttackTarget({
      difficulty: 'easy', attacker: card(9, 1, 3, 1), targets: [threat, runt],
    });
    expect(pick.id).toBe(3);
  });

  it('on hard still takes the kill', () => {
    const attacker = card(9, 1, 3, 1);
    const killable = card(4, 1, 4, 3);
    const pick = planAttackTarget({
      difficulty: 'hard', attacker, targets: [threat, killable], attackerField: [attacker],
    });
    expect(pick.id).toBe(4);
  });
});

describe('orderAttackers', () => {
  it('on hard sends the bear who can drop the Catcall first', () => {
    const small = card(1, 1, 1, 1, { instanceId: 's' });
    const big = card(2, 1, 5, 1, { instanceId: 'b' });
    const taunt = card(6, 1, 2, 4, { ability: 'taunt', currentHp: 4, instanceId: 't' });
    const ordered = orderAttackers({
      difficulty: 'hard',
      attackers: [small, big],
      attackerField: [small, big],
      enemyField: [taunt],
    });
    expect(ordered.map((c) => c.id)).toEqual([2, 1]);
  });

  it('on normal leaves the field order alone', () => {
    const a = card(1, 1, 5, 1);
    const b = card(2, 1, 1, 1);
    expect(orderAttackers({ difficulty: 'normal', attackers: [a, b] })).toEqual([a, b]);
  });
});

describe('mindLine', () => {
  it('names the three stools, and falls back to the middle', () => {
    expect(mindLine('easy')).toMatch(/swinging wild/);
    expect(mindLine('hard')).toMatch(/reading the table/);
    expect(mindLine('nope')).toBe(mindLine('normal'));
  });
});
