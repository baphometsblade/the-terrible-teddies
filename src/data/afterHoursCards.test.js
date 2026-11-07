import { describe, it, expect } from 'vitest';
import { AFTER_HOURS_CARDS } from './afterHoursCards';
import { ALL_CARDS } from '@/stores/gameStore';
import { simulateField } from '@/utils/battleSim';
import { ABILITY_LABELS } from '@/lib/abilities';

// Grown-ups only. The scan is the new set plus the names the card face uses
// for a keyword. Existing shipped lines are not in this file.
const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait|ageplay|incest|daddy|mommy|non-?consent|bestiality)\b/i;

describe('the after-hours cards', () => {
  it('adds at least 12 cards, all of them in the catalog', () => {
    expect(AFTER_HOURS_CARDS.length).toBeGreaterThanOrEqual(12);
    for (const card of AFTER_HOURS_CARDS) {
      expect(ALL_CARDS.find((c) => c.id === card.id)).toMatchObject(card);
    }
  });

  it('does not depict or name anyone under 18, or a non-consent punchline', () => {
    for (const card of AFTER_HOURS_CARDS) {
      expect(`${card.name} ${card.description}`, card.name).not.toMatch(BANNED);
    }
    for (const label of Object.values(ABILITY_LABELS)) {
      expect(label).not.toMatch(BANNED);
    }
  });

  // AI vs AI, same rules as the board. A new card outside this band is
  // winning or losing the room and gets retuned before it ships.
  it('keeps every new card between 45% and 58% over the field', () => {
    const { rows } = simulateField({ games: 2400, seed: 20261107, deckSize: 10 });
    const ids = new Set(AFTER_HOURS_CARDS.map((c) => c.id));
    const mine = rows.filter((row) => ids.has(row.id));
    expect(mine).toHaveLength(AFTER_HOURS_CARDS.length);
    const report = mine.map((row) => `${row.name} ${(row.rate * 100).toFixed(1)}% (${row.wins}/${row.games})`).join('\n');
    for (const row of mine) {
      expect(row.rate, `${row.name} is outside 45–58%.\n${report}`).toBeGreaterThanOrEqual(0.45);
      expect(row.rate, `${row.name} is outside 45–58%.\n${report}`).toBeLessThanOrEqual(0.58);
    }
  });
});
