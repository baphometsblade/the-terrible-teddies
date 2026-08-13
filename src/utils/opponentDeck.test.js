import { describe, it, expect } from 'vitest';
import { buildOpponentDeck, OPPONENT_GOONS, OPPONENT_HEALTH_MOD_BY_DIFFICULTY } from './opponentDeck';
import { ALL_CARDS } from '../stores/gameStore';
import { RARITY_ORDER } from '../lib/rarity';

// Deterministic seeded PRNG (mulberry32) so "same seed -> same deck" and
// "different seeds -> different decks" can be proven without depending on
// Math.random.
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const DIFFICULTIES = ['easy', 'normal', 'hard'];

describe('buildOpponentDeck', () => {
  it('always returns exactly 8 cards for every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const { cards } = buildOpponentDeck(difficulty, mulberry32(1));
      expect(cards).toHaveLength(8);
    }
  });

  it('every card has a unique instanceId', () => {
    for (const difficulty of DIFFICULTIES) {
      const { cards } = buildOpponentDeck(difficulty, mulberry32(42));
      const ids = cards.map((c) => c.instanceId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('all returned cards are type "action"', () => {
    for (const difficulty of DIFFICULTIES) {
      const { cards } = buildOpponentDeck(difficulty, mulberry32(7));
      for (const card of cards) {
        expect(card.type).toBe('action');
      }
    }
  });

  it('the same seed produces the same deck (determinism)', () => {
    const a = buildOpponentDeck('normal', mulberry32(123));
    const b = buildOpponentDeck('normal', mulberry32(123));
    expect(a.cards.map((c) => c.instanceId)).toEqual(b.cards.map((c) => c.instanceId));
    expect(a.crewName).toBe(b.crewName);
  });

  it('different seeds produce variety across many decks (not all identical)', () => {
    const decks = Array.from({ length: 20 }, (_, i) =>
      buildOpponentDeck('normal', mulberry32(i * 997 + 1)).cards.map((c) => c.instanceId).join(',')
    );
    const distinct = new Set(decks);
    // Extremely unlikely all 20 seeded decks collapse to one arrangement.
    expect(distinct.size).toBeGreaterThan(1);

    // Also prove variety in crew names, not just card order.
    const crewNames = Array.from({ length: 20 }, (_, i) =>
      buildOpponentDeck('normal', mulberry32(i * 5 + 3)).crewName
    );
    expect(new Set(crewNames).size).toBeGreaterThan(1);
  });

  it('hard decks skew to higher rarities than easy decks (distribution, not one sample)', () => {
    const rarityScore = (rarity) => RARITY_ORDER.indexOf(rarity);
    const avgScore = (difficulty, seedBase) => {
      const samples = 50;
      let total = 0;
      let count = 0;
      for (let i = 0; i < samples; i++) {
        const { cards } = buildOpponentDeck(difficulty, mulberry32(seedBase + i * 13));
        for (const card of cards) {
          total += rarityScore(card.rarity);
          count += 1;
        }
      }
      return total / count;
    };

    const easyAvg = avgScore('easy', 1000);
    const hardAvg = avgScore('hard', 2000);
    expect(hardAvg).toBeGreaterThan(easyAvg);
  });

  it('applies the difficulty stat modifier to every card (goon and catalog alike)', () => {
    // Use a fixed seed and compare each returned card's stats against its
    // unmodified source (goon baseline or catalog entry) by id.
    const baselineById = new Map([
      ...OPPONENT_GOONS.map((g) => [g.id, g]),
      ...ALL_CARDS.map((c) => [c.id, c]),
    ]);

    const expectedMods = { easy: { attack: -1, defense: -1 }, normal: { attack: 0, defense: 0 }, hard: { attack: 1, defense: 1 } };

    for (const difficulty of DIFFICULTIES) {
      const { cards } = buildOpponentDeck(difficulty, mulberry32(55));
      const mod = expectedMods[difficulty];
      for (const card of cards) {
        const baseline = baselineById.get(card.id);
        // The delta is clamped so a modifier can't push a stat out of range:
        // attack floors at 0, defense (the HP pool) at 1.
        expect(card.attack).toBe(Math.max(0, baseline.attack + mod.attack));
        expect(card.defense).toBe(Math.max(1, baseline.defense + mod.defense));
      }
    }
  });

  it('never fields a creature with defense < 1 (dead on arrival) on any difficulty', () => {
    // easy's defenseMod -1 unclamped turned any common/uncommon def-1 card into a
    // 0-HP creature destroyed by any hit — including a 0-damage one — the moment
    // it entered play. Sweep many seeds so the RNG surfaces those cards.
    for (let i = 0; i < 200; i++) {
      for (const difficulty of DIFFICULTIES) {
        const { cards } = buildOpponentDeck(difficulty, mulberry32(i * 17 + 5));
        for (const card of cards) {
          expect(card.defense, `${difficulty} #${card.id} ${card.name}`).toBeGreaterThanOrEqual(1);
          expect(card.attack, `${difficulty} #${card.id} ${card.name}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('exposes the same health modifiers GameBoard applies to opponent HP', () => {
    expect(OPPONENT_HEALTH_MOD_BY_DIFFICULTY.easy).toBe(-5);
    expect(OPPONENT_HEALTH_MOD_BY_DIFFICULTY.normal).toBe(0);
    expect(OPPONENT_HEALTH_MOD_BY_DIFFICULTY.hard).toBe(5);
  });

  it('never mutates ALL_CARDS or OPPONENT_GOONS across many builds', () => {
    const cardsSnapshot = JSON.parse(JSON.stringify(ALL_CARDS));
    const goonsSnapshot = JSON.parse(JSON.stringify(OPPONENT_GOONS));

    for (let i = 0; i < 50; i++) {
      for (const difficulty of DIFFICULTIES) {
        buildOpponentDeck(difficulty, mulberry32(i * 31 + 3));
      }
    }

    expect(ALL_CARDS).toEqual(cardsSnapshot);
    expect(OPPONENT_GOONS).toEqual(goonsSnapshot);
  });

  it('falls back to Math.random when no rng is provided (still returns a valid deck)', () => {
    const { cards, crewName } = buildOpponentDeck('normal');
    expect(cards).toHaveLength(8);
    expect(typeof crewName).toBe('string');
  });

  it('falls back to normal config for an unknown difficulty', () => {
    const { cards } = buildOpponentDeck('nightmare', mulberry32(9));
    expect(cards).toHaveLength(8);
  });
});
