import { describe, it, expect } from 'vitest';
import { ALL_CARDS } from './gameStore';
import { RARITY_ORDER } from '@/lib/rarity';

// Data-invariant guard over the card catalog: every card added here must
// satisfy the same shape the battle engine (GameBoard.jsx / battleUtils.js)
// actually implements, or it silently breaks in play instead of failing CI.
// None of these assertions hardcode the current catalog size (64 cards) —
// they must keep holding as the catalog grows.

const VALID_TYPES = ['action', 'trap', 'special'];
const VALID_ABILITIES = ['none', 'taunt', 'piercing', 'shield', 'stealth', 'protect', 'fury', 'swarm', 'royal'];
const VALID_SPECIAL_EFFECTS = ['heal', 'draw', 'buff'];
// Opponent goon deck ids reserved in GameBoard.jsx (101-108) — player catalog
// ids must stay below this range so card art/keys never collide.
const OPPONENT_GOON_ID_FLOOR = 100;

const label = (card) => `card "${card?.name}" (id: ${card?.id})`;

describe('ALL_CARDS catalog shape', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(ALL_CARDS)).toBe(true);
    expect(ALL_CARDS.length).toBeGreaterThan(0);
  });

  it('every card has a unique integer id below the reserved goon-deck range (101-108)', () => {
    const seen = new Map();
    for (const card of ALL_CARDS) {
      expect(Number.isInteger(card.id), `${label(card)} must have an integer id`).toBe(true);
      expect(
        card.id < OPPONENT_GOON_ID_FLOOR,
        `${label(card)} has id ${card.id}, which collides with the opponent goon deck's reserved range (101-108)`
      ).toBe(true);

      const dupe = seen.get(card.id);
      expect(dupe, `duplicate id ${card.id} shared by "${dupe?.name}" and "${card.name}"`).toBeUndefined();
      seen.set(card.id, card);
    }
  });

  it('every card has a unique, non-empty name', () => {
    const seen = new Map();
    for (const card of ALL_CARDS) {
      expect(typeof card.name, `${label(card)} must have a string name`).toBe('string');
      expect(card.name.length, `${label(card)} must have a non-empty name`).toBeGreaterThan(0);

      const dupe = seen.get(card.name);
      expect(dupe, `duplicate name "${card.name}" shared by id ${dupe?.id} and id ${card.id}`).toBeUndefined();
      seen.set(card.name, card);
    }
  });

  it('every card has a non-empty description', () => {
    for (const card of ALL_CARDS) {
      expect(typeof card.description, `${label(card)} must have a string description`).toBe('string');
      expect(card.description.length, `${label(card)} must have a non-empty description`).toBeGreaterThan(0);
    }
  });

  it("every card's type is one of 'action' | 'trap' | 'special'", () => {
    for (const card of ALL_CARDS) {
      expect(
        VALID_TYPES.includes(card.type),
        `${label(card)} has unknown type "${card.type}" — expected one of ${VALID_TYPES.join(', ')}`
      ).toBe(true);
    }
  });

  it("every card's rarity is a tier defined in RARITY_ORDER (or TeddyCard's RARITY[rarity] lookup crashes, and it never appears in pack pools)", () => {
    for (const card of ALL_CARDS) {
      expect(
        RARITY_ORDER.includes(card.rarity),
        `${label(card)} has unknown rarity "${card.rarity}" — expected one of ${RARITY_ORDER.join(', ')}`
      ).toBe(true);
    }
  });

  it('every card has an integer cost between 1 and 8', () => {
    for (const card of ALL_CARDS) {
      expect(Number.isInteger(card.cost), `${label(card)} must have an integer cost`).toBe(true);
      expect(card.cost, `${label(card)} has cost ${card.cost}, expected between 1 and 8`).toBeGreaterThanOrEqual(1);
      expect(card.cost, `${label(card)} has cost ${card.cost}, expected between 1 and 8`).toBeLessThanOrEqual(8);
    }
  });

  describe("type 'action' cards", () => {
    const actionCards = ALL_CARDS.filter((c) => c.type === 'action');

    it('has at least one action card to check', () => {
      expect(actionCards.length).toBeGreaterThan(0);
    });

    it('have integer attack and defense between 0 and 10', () => {
      for (const card of actionCards) {
        for (const field of ['attack', 'defense']) {
          expect(Number.isInteger(card[field]), `${label(card)} must have an integer ${field}`).toBe(true);
          expect(
            card[field],
            `${label(card)} has ${field} ${card[field]}, expected between 0 and 10`
          ).toBeGreaterThanOrEqual(0);
          expect(
            card[field],
            `${label(card)} has ${field} ${card[field]}, expected between 0 and 10`
          ).toBeLessThanOrEqual(10);
        }
      }
    });

    it('have an ability recognized by the battle engine (getValidTargets/battleUtils) or a known display-only keyword', () => {
      for (const card of actionCards) {
        expect(
          VALID_ABILITIES.includes(card.ability),
          `${label(card)} has unknown ability "${card.ability}" — expected one of ${VALID_ABILITIES.join(', ')}. ` +
            `An ability outside this list has no engine mechanic and renders a broken keyword that does nothing.`
        ).toBe(true);
      }
    });
  });

  describe("type 'trap' cards", () => {
    const trapCards = ALL_CARDS.filter((c) => c.type === 'trap');

    it('has at least one trap card to check', () => {
      expect(trapCards.length).toBeGreaterThan(0);
    });

    it("have effect === 'damage' with an integer amount > 0 (the only trap behavior GameBoard implements)", () => {
      for (const card of trapCards) {
        expect(
          card.effect,
          `${label(card)} has effect "${card.effect}" — traps only support 'damage' in GameBoard`
        ).toBe('damage');
        expect(Number.isInteger(card.amount), `${label(card)} must have an integer amount`).toBe(true);
        expect(card.amount, `${label(card)} has amount ${card.amount}, expected > 0`).toBeGreaterThan(0);
      }
    });
  });

  describe("type 'special' cards", () => {
    const specialCards = ALL_CARDS.filter((c) => c.type === 'special');

    it('has at least one special card to check', () => {
      expect(specialCards.length).toBeGreaterThan(0);
    });

    // applySpecialEffect in GameBoard.jsx only implements 'heal', 'draw', and
    // 'buff' — any other effect value falls through silently and the card
    // does nothing when played. That silent no-op is the bug this guard exists
    // to catch, so effect must be constrained to exactly these three values,
    // each with a positive integer amount.
    it("have effect one of 'heal' | 'draw' | 'buff' with an integer amount > 0", () => {
      for (const card of specialCards) {
        expect(
          VALID_SPECIAL_EFFECTS.includes(card.effect),
          `${label(card)} has effect "${card.effect}" — applySpecialEffect only implements ${VALID_SPECIAL_EFFECTS.join(', ')}; ` +
            `anything else silently does nothing when the card is played`
        ).toBe(true);
        expect(Number.isInteger(card.amount), `${label(card)} must have an integer amount`).toBe(true);
        expect(card.amount, `${label(card)} has amount ${card.amount}, expected > 0`).toBeGreaterThan(0);
      }
    });
  });
});
