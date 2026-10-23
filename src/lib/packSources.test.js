import { describe, it, expect } from 'vitest';
import { nextCoinPack, nextPassPack, nextDailyPack } from './packSources';
import { SHOP_ITEMS, DAILY_REWARDS } from '@/stores/gameStore';
import { BATTLE_PASS_REWARDS } from '@/components/BattlePass';

describe('nextCoinPack', () => {
  it('measures the gap to the cheapest coin pack in SHOP_ITEMS', () => {
    const cheapest = Math.min(...SHOP_ITEMS.filter((i) => i.type === 'pack' && i.currency === 'coins').map((i) => i.price));
    const p = nextCoinPack(50);
    expect(p.item.price).toBe(cheapest);
    expect(p.short).toBe(cheapest - 50);
    expect(p.progress).toBeCloseTo(50 / cheapest);
    expect(nextCoinPack(cheapest + 1)).toMatchObject({ short: 0, progress: 1 });
  });
});

describe('nextPassPack', () => {
  // Read from the real reward table, so a retuned pass moves the answer.
  const freePackTiers = BATTLE_PASS_REWARDS.filter((r) => r.free?.type === 'pack');

  it('names the first free tier that grants packs, with the XP still to go', () => {
    const first = freePackTiers[0];
    expect(nextPassPack({ seasonXP: 0 }, BATTLE_PASS_REWARDS)).toEqual({
      tier: first.tier, track: 'free', packs: first.free.amount, ready: first.xpRequired === 0, xpToGo: first.xpRequired,
    });
  });

  it('puts a reached, unclaimed pack tier first', () => {
    const [a, b] = freePackTiers;
    const p = nextPassPack({ seasonXP: b.xpRequired, claimed: { free: [], premium: [] } }, BATTLE_PASS_REWARDS);
    expect(p).toMatchObject({ tier: a.tier, ready: true, xpToGo: 0 });
    const q = nextPassPack({ seasonXP: b.xpRequired, claimed: { free: [a.tier], premium: [] } }, BATTLE_PASS_REWARDS);
    expect(q).toMatchObject({ tier: b.tier, ready: true });
  });

  it('counts the premium track only when the pass is owned', () => {
    const premiumOnly = BATTLE_PASS_REWARDS.find((r) => r.premium?.type === 'pack' && r.free?.type !== 'pack');
    expect(premiumOnly, 'the table has a premium-only pack tier').toBeTruthy();
    const claimedFree = freePackTiers.filter((r) => r.tier <= premiumOnly.tier).map((r) => r.tier);
    const state = { seasonXP: premiumOnly.xpRequired, claimed: { free: claimedFree, premium: [] } };
    expect(nextPassPack({ ...state, hasPremium: true }, BATTLE_PASS_REWARDS)).toMatchObject({ tier: premiumOnly.tier, track: 'premium', ready: true });
    expect(nextPassPack({ ...state, hasPremium: false }, BATTLE_PASS_REWARDS)?.track).not.toBe('premium');
  });

  it('is null once every pack tier is claimed', () => {
    const all = { free: freePackTiers.map((r) => r.tier), premium: [] };
    expect(nextPassPack({ seasonXP: 1e9, claimed: all }, BATTLE_PASS_REWARDS)).toBeNull();
  });
});

describe('nextDailyPack', () => {
  const today = new Date(2026, 9, 23);
  const yesterday = new Date(2026, 9, 22).toDateString();
  const packDays = DAILY_REWARDS.map((r, i) => (r.packs > 0 ? i + 1 : null)).filter(Boolean);

  it("counts from tomorrow once today's reward is in", () => {
    // Claimed today on streak day 1: the first pack day is that many days on.
    const p = nextDailyPack({ consecutiveLogins: 1, lastLoginDate: today.toDateString() }, today);
    expect(p.day).toBe(packDays[0]);
    expect(p.inDays).toBe(packDays[0] - 1);
    expect(p.packs).toBe(DAILY_REWARDS[packDays[0] - 1].packs);
  });

  it("is today when today's claim lands on a pack day", () => {
    const streak = packDays[0] - 1;
    expect(nextDailyPack({ consecutiveLogins: streak, lastLoginDate: yesterday }, today)).toMatchObject({ day: packDays[0], inDays: 0 });
  });

  it('restarts at day 1 when the streak has lapsed, as checkDailyLogin does', () => {
    const p = nextDailyPack({ consecutiveLogins: 6, lastLoginDate: new Date(2026, 9, 1).toDateString() }, today);
    expect(p).toMatchObject({ day: packDays[0], inDays: packDays[0] - 1 });
  });

  it('wraps round the weekly cycle', () => {
    // Claimed today on the last pack day: the next one is a cycle later.
    const last = packDays[packDays.length - 1];
    const p = nextDailyPack({ consecutiveLogins: last, lastLoginDate: today.toDateString() }, today);
    expect(p.day).toBe(packDays[0]);
    expect(p.inDays).toBe(DAILY_REWARDS.length - last + packDays[0]);
  });
});
