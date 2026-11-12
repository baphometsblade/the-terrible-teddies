import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/stores/gameStore';
import { COMBAT_CATALOG } from './catalog.js';

const pick = (card) => ({
  id: card.id,
  name: card.name,
  attack: card.attack || 0,
  defense: card.defense || 0,
  type: card.type,
  cost: card.cost || 0,
  ability: card.ability || 'none',
  effect: card.effect || null,
  amount: card.amount || 0,
  tribe: card.tribe || null,
});

describe('combat catalog', () => {
  it('matches the live card list field for field', () => {
    expect(COMBAT_CATALOG.map(pick)).toEqual(ALL_CARDS.map(pick));
  });
});
