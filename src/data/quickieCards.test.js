import { describe, expect, it } from 'vitest';
import { QUICKIE_CARDS } from './quickieCards';
import { ALL_CARDS } from '@/stores/gameStore';
import { simulateField } from '@/utils/battleSim';

const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait|ageplay|incest|daddy|mommy|non-?consent|bestiality)\b/i;

describe('the Quickie set', () => {
  it('is in the catalog, every one of them a grown rush bear', () => {
    expect(QUICKIE_CARDS.length).toBeGreaterThanOrEqual(4);
    for (const card of QUICKIE_CARDS) {
      expect(ALL_CARDS.find((c) => c.id === card.id)).toMatchObject(card);
      expect(card.ability).toBe('rush');
      expect(card.type).toBe('action');
      expect(`${card.name} ${card.description}`).not.toMatch(BANNED);
    }
  });

  it('keeps every new card between 45% and 56% over the field', () => {
    const { rows } = simulateField({ games: 2400, seed: 20261107, deckSize: 10 });
    const ids = new Set(QUICKIE_CARDS.map((c) => c.id));
    const mine = rows.filter((row) => ids.has(row.id));
    expect(mine).toHaveLength(QUICKIE_CARDS.length);
    const report = mine.map((row) => `${row.name} ${(row.rate * 100).toFixed(1)}% (${row.wins}/${row.games})`).join('\n');
    for (const row of mine) {
      expect(row.rate, `${row.name} is outside 45–56%.\n${report}`).toBeGreaterThanOrEqual(0.45);
      expect(row.rate, `${row.name} is outside 45–56%.\n${report}`).toBeLessThanOrEqual(0.56);
    }
  });
});
