import { describe, expect, it } from 'vitest';
import { NIGHT_TWO_CARDS } from './nightTwoCards';
import { ALL_CARDS } from '@/stores/gameStore';
import { simulateField } from '@/utils/battleSim';

const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait|ageplay|incest|daddy|mommy|non-?consent|bestiality)\b/i;

describe('the second night', () => {
  it('adds the three new keywords, all of them grown', () => {
    expect(NIGHT_TWO_CARDS.map((card) => card.ability).sort()).toEqual(
      ['blackout', 'blackout', 'hungover', 'hungover', 'smitten', 'smitten'],
    );
    for (const card of NIGHT_TWO_CARDS) {
      expect(ALL_CARDS.find((c) => c.id === card.id)).toMatchObject(card);
      expect(`${card.name} ${card.description}`).not.toMatch(BANNED);
      expect(card.tribe).toBeTruthy();
    }
  });

  it('keeps every new card between 45% and 56% over the field', () => {
    const { rows } = simulateField({ games: 2400, seed: 20261107, deckSize: 10 });
    const ids = new Set(NIGHT_TWO_CARDS.map((c) => c.id));
    const mine = rows.filter((row) => ids.has(row.id));
    expect(mine).toHaveLength(NIGHT_TWO_CARDS.length);
    const report = mine.map((row) => `${row.name} ${(row.rate * 100).toFixed(1)}% (${row.wins}/${row.games})`).join('\n');
    for (const row of mine) {
      expect(row.rate, `${row.name} is outside 45–56%.\n${report}`).toBeGreaterThanOrEqual(0.45);
      expect(row.rate, `${row.name} is outside 45–56%.\n${report}`).toBeLessThanOrEqual(0.56);
    }
  });
});
