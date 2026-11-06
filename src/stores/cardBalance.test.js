import { describe, it, expect } from 'vitest';
import { ALL_CARDS } from './gameStore';

// The 2-drop pass. Shitstarter Ted (3/2, no ability) and Shit-Talk Sally
// (2/3, Taunt) are the line a 2-cost bear should stand near: 5 stats, or 4
// when a keyword is doing real work. The cards below were 3 stats, or they
// carried a keyword that could never turn on (Fury and Protect on 1 HP of
// room, Stealth on a body any tap deleted).
const byName = (name) => ALL_CARDS.find((c) => c.name === name);
const body = (card) => card.attack + card.defense;

describe('2-drop bodies', () => {
  const ted = byName('Shitstarter Ted');
  const sally = byName('Shit-Talk Sally');

  it('keeps Ted and Sally as the 5-stat line', () => {
    expect(ted.cost).toBe(2);
    expect(body(ted)).toBe(5);
    expect(sally.cost).toBe(2);
    expect(body(sally)).toBe(5);
    expect(sally.ability).toBe('taunt');
  });

  it('brings the weak 2-drops up to that line', () => {
    // 2/2 Swarm. Alone he is one stat behind Ted; with a friend he costs 1,
    // which is the keyword paying the rest.
    expect(byName('Feral Tim')).toMatchObject({ attack: 2, defense: 2, cost: 2, ability: 'swarm' });
    // 2/2 Stealth. The old 2/1 died to the first thing that could see him.
    expect(byName('Dumpster Dave')).toMatchObject({ attack: 2, defense: 2, cost: 2, ability: 'stealth' });
    // 2/2 Fury. At 1 HP a hit killed her before Fury could add anything.
    expect(byName('Two-Beer Tina')).toMatchObject({ attack: 2, defense: 2, cost: 2, ability: 'fury' });
    // 2/2 Protect. 1 attack and 2 HP fell over before the aura mattered.
    expect(byName('Sticky Mickey')).toMatchObject({ attack: 2, defense: 2, cost: 2, ability: 'protect' });
    // 3/2, no keyword: the same body as Ted. He was 3/1.
    expect(byName('Mange Marvin')).toMatchObject({ attack: 3, defense: 2, cost: 2, ability: 'none' });
    // 2/3, no keyword: Sally's body without Taunt. He was 1/3.
    expect(byName('Stitches the Snitch')).toMatchObject({ attack: 2, defense: 3, cost: 2, ability: 'none' });
    // Uncommon. 3/2 Stealth matches Sally's body, and he lives past the turn
    // Stealth wears off. He was 3/1.
    expect(byName('Peeping Pete')).toMatchObject({ attack: 3, defense: 2, cost: 2, ability: 'stealth' });
    // The AI-vs-AI field (1600 games, seed 20261106). Shield was winning the
    // room: Lord Fluffington 65.9% at 4/4, Beargaritaville 60.1% at 2/3.
    // One health off each. The worst trap, Glass in the Gummy Bears, won
    // 35.8% at 3 damage; it now hits for 4.
    expect(byName('Lord Fluffington, Disgraced')).toMatchObject({ attack: 4, defense: 3, cost: 5, ability: 'shield' });
    expect(byName('Beargaritaville')).toMatchObject({ attack: 2, defense: 2, cost: 2, ability: 'shield' });
    expect(byName('Glass in the Gummy Bears').amount).toBe(4);
  });
});
