import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/stores/gameStore';
import { MAX_CARD_ID } from '@/lib/social/ladder';
import { fromLadderId, toLadderId } from './cardRegistry';

describe('the card registry', () => {
  it('keeps every catalog id and every ladder id unique', () => {
    const ids = new Map();
    const ladders = new Map();
    for (const card of ALL_CARDS) {
      const prior = ids.get(card.id);
      expect(prior, `duplicate id ${card.id} on ${card.name} and ${prior?.name}`).toBeUndefined();
      ids.set(card.id, card);
      if (card.ladderId == null) continue;
      expect(Number.isInteger(card.ladderId), card.name).toBe(true);
      expect(card.ladderId, card.name).toBeGreaterThanOrEqual(1);
      expect(card.ladderId, card.name).toBeLessThanOrEqual(MAX_CARD_ID);
      expect(ALL_CARDS.some((other) => other.id === card.ladderId), card.name).toBe(false);
      const other = ladders.get(card.ladderId);
      expect(other, `ladder id ${card.ladderId} shared by ${card.name} and ${other?.name}`).toBeUndefined();
      ladders.set(card.ladderId, card);
      expect(toLadderId(card.id)).toBe(card.ladderId);
      expect(fromLadderId(card.ladderId)).toBe(card.id);
    }
    expect(toLadderId(4)).toBe(4);
    expect(fromLadderId(4)).toBe(4);
  });
});
