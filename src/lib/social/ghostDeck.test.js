import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/stores/gameStore';
import { cardsFromIds } from './ghostDeck';

describe('cardsFromIds', () => {
  it('copies catalog cards in order and drops ids the catalog does not have', () => {
    const [first, second] = ALL_CARDS;
    const cards = cardsFromIds([second.id, 99999, first.id], ALL_CARDS);
    expect(cards.map((card) => card.id)).toEqual([second.id, first.id]);
    expect(cards[0]).not.toBe(second);
    expect(cards[0].attack).toBe(second.attack);
    expect(cards[0].instanceId).toBe(`g-${second.id}-0`);
    cards[0].attack = 99;
    expect(second.attack).not.toBe(99);
  });
});
