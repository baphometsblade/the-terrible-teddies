import { describe, expect, it } from 'vitest';
import { ALL_CARDS, DAILY_REWARDS, PACK_ODDS, PACK_SLOTS } from '@/stores/gameStore';
import {
  BONUS_EVERY, EARNED_OPENS_PER_DAY, PITY_EVERY, SELLBACK_RATE, steadyReturn,
} from './packEconomy';
import { simulateProfiles } from './packSim';

const STARTER = [1, 2, 3, 4, 5, 6, 30, 31, 40, 41, 42];

describe('pack economy parity and the 30-day loop', () => {
  it('gem packs and earned packs share one table, one pity and one sell-back', () => {
    for (const slots of Object.values(PACK_SLOTS)) {
      expect(slots.first).toBe('standard');
    }
    expect(Object.keys(PACK_ODDS)).toEqual(['standard']);
    expect(PITY_EVERY).toBe(10);
    expect(SELLBACK_RATE).toBeCloseTo(0.4);
    expect(BONUS_EVERY).toBe(6);
    expect(EARNED_OPENS_PER_DAY).toBeGreaterThan(0);
  });

  it('a full binder still earns a small margin on the bulk pack', () => {
    const perPack = steadyReturn({
      table: PACK_ODDS.standard,
      cards: ALL_CARDS,
      size: 5,
      samples: 2400,
      seed: 11,
    });
    const margin = (perPack - 160) / 160;
    expect(margin, `steady return ${perPack.toFixed(1)}`).toBeGreaterThan(0.04);
    expect(margin, `steady return ${perPack.toFixed(1)}`).toBeLessThan(0.12);
  });

  it('paying finishes a set sooner and nobody gets a higher ceiling', () => {
    const run = simulateProfiles({
      cards: ALL_CARDS,
      table: PACK_ODDS.standard,
      rewards: DAILY_REWARDS,
      days: 30,
      seed: 0x71ed,
      starter: STARTER,
    });
    for (const name of ['casual', 'dedicated', 'paying']) {
      expect(run[name].starCap).toBe(3);
      expect(run[name].deckCeiling).toBe(5);
      expect(run[name].storageCeiling).toBe(ALL_CARDS.length);
      expect(run[name].maxStar).toBeLessThanOrEqual(3);
    }
    expect(run.dedicated.margin).toBeGreaterThan(0.05);
    expect(run.dedicated.margin).toBeLessThan(0.1);
    expect(run.casual.margin).toBeGreaterThan(0.05);
    expect(run.casual.margin).toBeLessThan(0.1);
    expect(run.casual.coins).toBeGreaterThan(500);
    expect(run.dedicated.coins).toBeGreaterThan(500);
    expect(run.casual.gates.crawlWait).toBeGreaterThan(0);
    expect(run.dedicated.gates.atCap + run.dedicated.gates.diminished + run.dedicated.gates.crawlWait).toBeGreaterThan(0);
    expect(run.paying.daysToCommonSet).toBeLessThan(run.dedicated.daysToCommonSet);
    expect(run.casual.daysToCommonSet == null || run.casual.daysToCommonSet > run.dedicated.daysToCommonSet).toBe(true);
    expect(run.paying.maxStar).toBe(run.dedicated.maxStar);
    expect(run.dedicated.owned).toBeGreaterThan(run.casual.owned);
    // A dedicated free player can hold the catalog. Paying does not hold more.
    expect(run.dedicated.storage).toBe(ALL_CARDS.length);
    expect(run.paying.storage).toBe(ALL_CARDS.length);
    expect(run.paying.deckSlots).toBe(run.dedicated.deckSlots);
  });
});
