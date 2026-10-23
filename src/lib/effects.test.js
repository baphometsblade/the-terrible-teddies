import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { effectLabel, effectRules, PLAYER_MAX_HEALTH, TRAP_DEFAULT_DAMAGE } from './effects';
import { ALL_CARDS } from '@/stores/gameStore';

// The numbers these sentences quote are read from the engine's own source,
// not restated, so retuning the battle without the copy fails here (the same
// read-the-source approach abilities.test.js and gemBundles.test.js take).
const board = readFileSync(resolve(process.cwd(), 'src/components/GameBoard/GameBoard.jsx'), 'utf8');
const engineMaxHealth = Number(board.match(/const PLAYER_MAX_HEALTH = (\d+);/)?.[1]);
const engineTrapDefaults = [...board.matchAll(/const trapDamage = trap\.amount \|\| (\d+);/g)].map((m) => Number(m[1]));

const traps = ALL_CARDS.filter((c) => c.type === 'trap');
const specials = ALL_CARDS.filter((c) => c.type === 'special');

describe('effect rules text', () => {
  it('quotes the health cap the engine heals to', () => {
    expect(engineMaxHealth).toBeGreaterThan(0);
    expect(PLAYER_MAX_HEALTH).toBe(engineMaxHealth);
  });

  it('quotes the damage the engine gives a trap with no amount, on both sides of the table', () => {
    // The player's attack on Chuck's trap, and Chuck's on the player's (today
    // two copies of the same line; however many there are, all must agree).
    expect(engineTrapDefaults.length).toBeGreaterThan(0);
    for (const d of engineTrapDefaults) expect(TRAP_DEFAULT_DAMAGE).toBe(d);
  });

  it('explains every trap and special in the catalog, with its own amount', () => {
    expect(traps.length).toBeGreaterThan(0);
    expect(specials.length).toBeGreaterThan(0);
    for (const card of [...traps, ...specials]) {
      const text = effectRules(card);
      expect(text, `no rules text for ${card.name}`).not.toBe('');
      expect(text, `${card.name}'s rules text does not say how much`).toContain(String(card.amount || TRAP_DEFAULT_DAMAGE));
      expect(effectLabel(card), `no effect label for ${card.name}`).not.toBe('');
    }
  });

  it('says what each kind of effect does', () => {
    expect(effectRules({ type: 'special', effect: 'heal', amount: 5 })).toBe('Restores 5 of your health, up to your maximum of 30.');
    expect(effectRules({ type: 'special', effect: 'draw', amount: 1 })).toBe('Draws 1 card from your deck.');
    expect(effectRules({ type: 'special', effect: 'draw', amount: 3 })).toBe('Draws 3 cards from your deck.');
    expect(effectRules({ type: 'special', effect: 'buff', amount: 2 })).toMatch(/creature you have on the table gains \+2 attack/);
    // A trap is about direct attacks: it never blocks an attack on a creature.
    expect(effectRules({ type: 'trap', effect: 'damage', amount: 4 })).toMatch(/attack aimed straight at you.*takes 4 damage/);
    expect(effectRules({ type: 'trap', effect: 'damage' })).toContain(`${TRAP_DEFAULT_DAMAGE} damage`);
  });

  it('has nothing to say about a creature, or an effect the engine does not resolve', () => {
    const creature = ALL_CARDS.find((c) => c.type === 'action');
    expect(effectRules(creature)).toBe('');
    expect(effectLabel(creature)).toBe('');
    expect(effectRules({ type: 'special', effect: 'teleport', amount: 1 })).toBe('');
    expect(effectRules(undefined)).toBe('');
  });
});
