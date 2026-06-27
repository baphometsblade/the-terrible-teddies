import { calculateDamage, calculateCardDamage, rollForCritical } from './battleUtils';

describe('calculateDamage', () => {
  describe('normal damage (attack minus defense)', () => {
    it('subtracts defender defense from attacker attack', () => {
      const attacker = { attack: 10 };
      const defender = { defense: 4 };
      // 10 - 4 = 6
      expect(calculateDamage(attacker, defender)).toBe(6);
    });

    it('returns full attack when defender has zero defense', () => {
      expect(calculateDamage({ attack: 7 }, { defense: 0 })).toBe(7);
    });

    it('floors at 0 when defense exceeds attack (never negative)', () => {
      // 5 - 20 = -15 -> max(0, ...) = 0
      expect(calculateDamage({ attack: 5 }, { defense: 20 })).toBe(0);
    });

    it('returns 0 against a target with very high defense', () => {
      expect(calculateDamage({ attack: 50 }, { defense: 9999 })).toBe(0);
    });

    it('returns 0 (not negative) when attack equals defense', () => {
      expect(calculateDamage({ attack: 8 }, { defense: 8 })).toBe(0);
    });
  });

  describe('piercing ability (ignores defense)', () => {
    it('ignores defender defense entirely', () => {
      const attacker = { attack: 10, ability: 'piercing' };
      const defender = { defense: 7 };
      // defense ignored -> 10
      expect(calculateDamage(attacker, defender)).toBe(10);
    });

    it('ignores even very high defense', () => {
      const attacker = { attack: 12, ability: 'piercing' };
      const defender = { defense: 9999 };
      expect(calculateDamage(attacker, defender)).toBe(12);
    });

    it('also ignores defenseBoost since defense is skipped', () => {
      const attacker = { attack: 15, ability: 'piercing' };
      const defender = { defense: 5 };
      // piercing skips the whole defense+boost subtraction
      expect(calculateDamage(attacker, defender, { defenseBoost: 100 })).toBe(15);
    });
  });

  describe('shield ability (reduces damage by 50%)', () => {
    it('halves the post-defense damage and floors it', () => {
      const attacker = { attack: 10 };
      const defender = { defense: 3, ability: 'shield' };
      // (10 - 3) = 7, floor(7 / 2) = 3
      expect(calculateDamage(attacker, defender)).toBe(3);
    });

    it('halves an even post-defense damage exactly', () => {
      const attacker = { attack: 10 };
      const defender = { defense: 2, ability: 'shield' };
      // (10 - 2) = 8, floor(8 / 2) = 4
      expect(calculateDamage(attacker, defender)).toBe(4);
    });

    it('applies shield after piercing has ignored defense', () => {
      const attacker = { attack: 9, ability: 'piercing' };
      const defender = { defense: 100, ability: 'shield' };
      // piercing -> 9, shield -> floor(9 / 2) = 4
      expect(calculateDamage(attacker, defender)).toBe(4);
    });

    it('still returns 0 when defense already reduced damage below zero', () => {
      const attacker = { attack: 2 };
      const defender = { defense: 10, ability: 'shield' };
      // (2 - 10) = -8, floor(-8 / 2) = -4, max(0, -4) = 0
      expect(calculateDamage(attacker, defender)).toBe(0);
    });
  });

  describe('defenseBoost option', () => {
    it('adds the boost to the defender defense before subtracting', () => {
      const attacker = { attack: 20 };
      const defender = { defense: 5 };
      // 20 - (5 + 4) = 11
      expect(calculateDamage(attacker, defender, { defenseBoost: 4 })).toBe(11);
    });

    it('can floor damage to 0 when boost makes total defense too high', () => {
      const attacker = { attack: 10 };
      const defender = { defense: 5 };
      // 10 - (5 + 50) = -45 -> 0
      expect(calculateDamage(attacker, defender, { defenseBoost: 50 })).toBe(0);
    });
  });

  describe('weather effects', () => {
    it('boosts damage by 20% on a Sunny Day', () => {
      const attacker = { attack: 10 };
      const defender = { defense: 0 };
      // 10 * 1.2 = 12
      expect(
        calculateDamage(attacker, defender, { weatherEffect: { name: 'Sunny Day' } })
      ).toBe(12);
    });

    it('reduces damage by 20% on a Rainy Day (floored)', () => {
      const attacker = { attack: 10 };
      const defender = { defense: 0 };
      // 10 * 0.8 = 8
      expect(
        calculateDamage(attacker, defender, { weatherEffect: { name: 'Rainy Day' } })
      ).toBe(8);
    });

    it('floors fractional results from weather multipliers', () => {
      const attacker = { attack: 7 };
      const defender = { defense: 0 };
      // 7 * 1.2 = 8.4 -> floor 8
      expect(
        calculateDamage(attacker, defender, { weatherEffect: { name: 'Sunny Day' } })
      ).toBe(8);
    });

    it('ignores unknown weather names', () => {
      const attacker = { attack: 10 };
      const defender = { defense: 2 };
      // unknown weather has no multiplier -> 10 - 2 = 8
      expect(
        calculateDamage(attacker, defender, { weatherEffect: { name: 'Foggy' } })
      ).toBe(8);
    });
  });

  describe('critical hits', () => {
    it('boosts damage by 50% on a critical hit', () => {
      const attacker = { attack: 10 };
      const defender = { defense: 0 };
      // 10 * 1.5 = 15
      expect(calculateDamage(attacker, defender, { isCritical: true })).toBe(15);
    });

    it('floors fractional critical damage', () => {
      const attacker = { attack: 5 };
      const defender = { defense: 0 };
      // 5 * 1.5 = 7.5 -> floor 7
      expect(calculateDamage(attacker, defender, { isCritical: true })).toBe(7);
    });
  });

  describe('combined modifiers', () => {
    it('stacks shield, sunny weather and critical correctly', () => {
      const attacker = { attack: 12 };
      const defender = { defense: 2, ability: 'shield' };
      // (12 - 2) = 10; shield floor(10/2) = 5; sunny 5*1.2 = 6; crit 6*1.5 = 9; floor 9
      expect(
        calculateDamage(attacker, defender, {
          weatherEffect: { name: 'Sunny Day' },
          isCritical: true,
        })
      ).toBe(9);
    });
  });

  describe('random factor', () => {
    it('keeps damage within the 0.9-1.1 randomized band', () => {
      const attacker = { attack: 100 };
      const defender = { defense: 0 };
      for (let i = 0; i < 200; i += 1) {
        const result = calculateDamage(attacker, defender, { useRandomFactor: true });
        // base 100, factor in [0.9, 1.1) -> [90, 110), floored
        expect(result).toBeGreaterThanOrEqual(90);
        expect(result).toBeLessThanOrEqual(110);
      }
    });

    it('uses the lower bound of the random factor when Math.random returns 0', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = calculateDamage(
        { attack: 100 },
        { defense: 0 },
        { useRandomFactor: true }
      );
      // factor = 0 * 0.2 + 0.9 = 0.9 -> 100 * 0.9 = 90
      expect(result).toBe(90);
      spy.mockRestore();
    });
  });

  describe('return type', () => {
    it('always returns an integer', () => {
      const result = calculateDamage(
        { attack: 7 },
        { defense: 0 },
        { isCritical: true }
      );
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});

describe('calculateCardDamage', () => {
  it('computes attack minus defense', () => {
    expect(calculateCardDamage({ attack: 10 }, { defense: 4 })).toBe(6);
  });

  it('ignores defense for piercing attackers', () => {
    expect(
      calculateCardDamage({ attack: 10, ability: 'piercing' }, { defense: 7 })
    ).toBe(10);
  });

  it('halves damage for shielded defenders (floored)', () => {
    // (10 - 3) = 7, floor(7/2) = 3
    expect(
      calculateCardDamage({ attack: 10 }, { defense: 3, ability: 'shield' })
    ).toBe(3);
  });

  it('floors at 0 against a very high defense target', () => {
    expect(calculateCardDamage({ attack: 5 }, { defense: 9999 })).toBe(0);
  });

  it('matches calculateDamage with no options', () => {
    const attacker = { attack: 13, ability: 'piercing' };
    const defender = { defense: 6, ability: 'shield' };
    expect(calculateCardDamage(attacker, defender)).toBe(
      calculateDamage(attacker, defender, {})
    );
  });
});

describe('rollForCritical', () => {
  it('returns true when the roll lands below the critical chance', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.04); // 4 < 5
    expect(rollForCritical({ criticalChance: 5 })).toBe(true);
    spy.mockRestore();
  });

  it('returns false when the roll lands at or above the critical chance', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // 50 >= 5
    expect(rollForCritical({ criticalChance: 5 })).toBe(false);
    spy.mockRestore();
  });

  it('defaults to a 5% critical chance when not specified', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.049); // 4.9 < 5
    expect(rollForCritical({})).toBe(true);
    spy.mockRestore();
  });

  it('treats roll exactly equal to the chance as a miss (strict less-than)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.05); // 5 < 5 is false
    expect(rollForCritical({ criticalChance: 5 })).toBe(false);
    spy.mockRestore();
  });

  it('applies the criticalChanceBoost to the base chance', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.09); // 9 < (5 + 5) = 10
    expect(rollForCritical({ criticalChance: 5 }, 5)).toBe(true);
    spy.mockRestore();
  });
});
