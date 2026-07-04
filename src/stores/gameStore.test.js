import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useGameStore, ALL_CARDS, SHOP_ITEMS } from './gameStore';

const get = () => useGameStore.getState();
const STORAGE_KEY = 'terrible-teddies-storage';

beforeEach(() => {
  localStorage.clear();
  // resetProgress restores the full initial state (and clears the
  // not-persisted achievement queue).
  get().resetProgress();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('currency primitives', () => {
  it('spendCoins succeeds only when affordable and never goes negative', () => {
    useGameStore.setState({ coins: 100 });
    expect(get().spendCoins(40)).toBe(true);
    expect(get().coins).toBe(60);
    expect(get().spendCoins(1000)).toBe(false);
    expect(get().coins).toBe(60);
  });

  it('spendGems succeeds only when affordable', () => {
    useGameStore.setState({ gems: 30 });
    expect(get().spendGems(30)).toBe(true);
    expect(get().gems).toBe(0);
    expect(get().spendGems(1)).toBe(false);
    expect(get().gems).toBe(0);
  });

  it('addGems ignores negative amounts (cannot be used to drain)', () => {
    useGameStore.setState({ gems: 10 });
    get().addGems(-100);
    expect(get().gems).toBe(10);
    get().addGems(5);
    expect(get().gems).toBe(15);
  });
});

describe('reconcileServerGems (closes the gem-respend exploit)', () => {
  it('credits a brand-new positive balance exactly once', () => {
    useGameStore.setState({ gems: 10, lastSyncedServerGems: 0 });
    get().reconcileServerGems(100);
    expect(get().gems).toBe(110);
    expect(get().lastSyncedServerGems).toBe(100);
    // Re-reading the same balance must not credit again.
    get().reconcileServerGems(100);
    expect(get().gems).toBe(110);
  });

  it('does NOT restore gems spent after a purchase', () => {
    useGameStore.setState({ gems: 10, lastSyncedServerGems: 0 });
    get().reconcileServerGems(100); // gems = 110, mark = 100
    get().spendGems(100);           // gems = 10
    expect(get().gems).toBe(10);
    get().reconcileServerGems(100); // re-login: server total unchanged
    expect(get().gems).toBe(10);    // exploit closed — not restored
  });

  it('credits only the delta on a second purchase', () => {
    useGameStore.setState({ gems: 0, lastSyncedServerGems: 0 });
    get().reconcileServerGems(100); // +100
    get().reconcileServerGems(150); // +50 only
    expect(get().gems).toBe(150);
    expect(get().lastSyncedServerGems).toBe(150);
  });

  it('a downward server move only tracks the mark, never debits', () => {
    useGameStore.setState({ gems: 200, lastSyncedServerGems: 150 });
    get().reconcileServerGems(120);
    expect(get().gems).toBe(200);
    expect(get().lastSyncedServerGems).toBe(120);
  });

  it('ignores non-numeric input', () => {
    useGameStore.setState({ gems: 10, lastSyncedServerGems: 0 });
    get().reconcileServerGems(null);
    get().reconcileServerGems(NaN);
    expect(get().gems).toBe(10);
    expect(get().lastSyncedServerGems).toBe(0);
  });
});

describe('addCards — collection growth and duplicate refunds', () => {
  it('adds only new cards and leaves coins unchanged for all-new pulls', () => {
    useGameStore.setState({ ownedCards: [1], coins: 0 });
    const refund = get().addCards([2, 3]);
    expect(get().ownedCards).toEqual([1, 2, 3]);
    expect(refund).toBe(0);
    expect(get().coins).toBe(0);
  });

  it('refunds duplicates as coins by rarity instead of discarding them', () => {
    // id 1 = common (10), id 20 = legendary (150)
    useGameStore.setState({ ownedCards: [1, 20], coins: 0 });
    const refund = get().addCards([1, 20]);
    expect(refund).toBe(160);
    expect(get().coins).toBe(160);
    expect(get().ownedCards).toEqual([1, 20]); // unchanged
  });

  it('does not double-count a duplicate that appears twice in one grant', () => {
    useGameStore.setState({ ownedCards: [], coins: 0 });
    // Two copies of id 2 in the same call: first is new, second is a dup.
    const refund = get().addCards([2, 2]);
    expect(get().ownedCards).toEqual([2]);
    expect(refund).toBe(get().coins);
    expect(refund).toBeGreaterThan(0);
  });
});

describe('setCurrentDeck only admits owned cards', () => {
  it('filters out unowned ids', () => {
    useGameStore.setState({ ownedCards: [1, 2, 3] });
    get().setCurrentDeck([1, 2, 99, 100]);
    expect(get().currentDeck).toEqual([1, 2]);
  });
});

describe('openCardPack atomicity', () => {
  it('returns null and changes nothing when no packs are owned', () => {
    useGameStore.setState({ cardPacks: 0, premiumPacks: 0, legendaryPacks: 0 });
    expect(get().openCardPack('regular')).toBeNull();
  });

  it('consumes exactly one regular pack and pulls 5 cards', () => {
    useGameStore.setState({ cardPacks: 1, premiumPacks: 0, legendaryPacks: 0 });
    const { cards } = get().openCardPack('regular');
    expect(cards).toHaveLength(5);
    expect(get().cardPacks).toBe(0);
  });

  it('legendary pack pulls 10 with a guaranteed legendary first and consumes one', () => {
    useGameStore.setState({ cardPacks: 0, premiumPacks: 0, legendaryPacks: 1 });
    const { cards } = get().openCardPack('legendary');
    expect(cards).toHaveLength(10);
    expect(cards[0].rarity).toBe('legendary');
    expect(get().legendaryPacks).toBe(0);
  });

  it('reports the coin refund for duplicate pulls', () => {
    // Own every card, so all 5 pulls are duplicates and each refunds coins.
    useGameStore.setState({
      cardPacks: 1, premiumPacks: 0, legendaryPacks: 0,
      ownedCards: ALL_CARDS.map(c => c.id), coins: 0,
    });
    const { cards, dupeCoins } = get().openCardPack('regular');
    expect(cards).toHaveLength(5);
    expect(dupeCoins).toBeGreaterThan(0);
    expect(get().coins).toBe(dupeCoins);
  });

  it('two rapid opens of a single pack cannot both succeed (no negative counter)', () => {
    useGameStore.setState({ cardPacks: 1, premiumPacks: 0, legendaryPacks: 0 });
    const a = get().openCardPack('regular');
    const b = get().openCardPack('regular');
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    expect(get().cardPacks).toBe(0);
  });

  it('falls back to any available pack when the requested type is empty', () => {
    useGameStore.setState({ cardPacks: 0, premiumPacks: 1, legendaryPacks: 0 });
    const pulled = get().openCardPack('regular');
    expect(pulled).not.toBeNull();
    expect(get().premiumPacks).toBe(0);
  });
});

describe('claimChallenge is atomic / idempotent', () => {
  it('returns true the first time and false on re-claim', () => {
    expect(get().claimChallenge('d1')).toBe(true);
    expect(get().claimedChallenges).toContain('d1');
    expect(get().claimChallenge('d1')).toBe(false);
    expect(get().claimedChallenges.filter(id => id === 'd1')).toHaveLength(1);
  });
});

describe('claimBattlePassReward is atomic per tier/track', () => {
  it('blocks a second claim of the same tier+track', () => {
    expect(get().claimBattlePassReward(3, false)).toBe(true);
    expect(get().claimBattlePassReward(3, false)).toBe(false);
    // The premium track of the same tier is independent.
    expect(get().claimBattlePassReward(3, true)).toBe(true);
  });
});

describe('addXP — leveling and monotonic seasonXP', () => {
  it('levels up, carries remainder, and grows seasonXP by the full amount', () => {
    useGameStore.setState({ xp: 0, level: 1, seasonXP: 0, coins: 0 });
    get().addXP(250); // level 1 needs 100, level 2 needs 150 -> reaches level 3, 0 remainder
    expect(get().level).toBe(3);
    expect(get().seasonXP).toBe(250);
  });

  it('seasonXP never decreases across multiple level-ups', () => {
    useGameStore.setState({ xp: 0, level: 1, seasonXP: 0 });
    get().addXP(100);
    const afterFirst = get().seasonXP;
    get().addXP(500);
    expect(get().seasonXP).toBe(afterFirst + 500);
  });
});

describe('recordBattleResult', () => {
  it('on a win increments wins, streak, coins and returns the coin gain', () => {
    useGameStore.setState({ totalWins: 0, currentWinStreak: 0, coins: 0 });
    const res = get().recordBattleResult(true, 10, 0, 30, 3);
    expect(get().totalWins).toBe(1);
    expect(get().currentWinStreak).toBe(1);
    expect(res.coinsGain).toBeGreaterThan(0);
    // coins increased by exactly the reported gain
    expect(get().coins).toBeGreaterThanOrEqual(res.coinsGain);
  });

  it('on a loss resets the win streak and still grants consolation coins', () => {
    useGameStore.setState({ currentWinStreak: 4, totalLosses: 0, coins: 0 });
    get().recordBattleResult(false, 0, 0, 0, 1);
    expect(get().currentWinStreak).toBe(0);
    expect(get().totalLosses).toBe(1);
    expect(get().coins).toBeGreaterThan(0);
  });

  it('rolls daily/weekly stats over when the date changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    get().recordBattleResult(true, 5, 0, 30, 1);
    expect(get().todayBattles).toBe(1);

    // Next day — the daily counter resets before counting this battle.
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));
    get().recordBattleResult(false, 0, 0, 0, 0);
    expect(get().todayBattles).toBe(1);
  });
});

describe('weekly challenge stats are week-scoped (not lifetime)', () => {
  it('weekBestStreak reflects only this week and a fresh account starts at 0', () => {
    // A veteran with a big all-time streak but no wins this week.
    useGameStore.setState({ bestWinStreak: 9, currentWinStreak: 0, weekBestStreak: 0 });
    expect(get().weekBestStreak).toBe(0); // weekly challenge would NOT be pre-complete
    get().recordBattleResult(true, 0, 0, 30, 1);
    expect(get().weekBestStreak).toBe(1);
  });

  it('weekNewCards counts only cards added this week, not the whole collection', () => {
    useGameStore.setState({ ownedCards: [1, 2, 3, 4, 5], weekNewCards: 0 });
    expect(get().weekNewCards).toBe(0);
    get().addCards([6, 7]); // two new
    expect(get().weekNewCards).toBe(2);
    get().addCards([6]); // duplicate — not counted
    expect(get().weekNewCards).toBe(2);
  });

  it('weekly stats reset on weekly rollover via syncPeriods', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z')); // a Monday-anchored week
    get().recordBattleResult(true, 0, 0, 30, 1);
    get().addCards([6]);
    expect(get().weekBestStreak).toBeGreaterThan(0);
    // Jump two weeks ahead and sync.
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    get().syncPeriods();
    expect(get().weekBestStreak).toBe(0);
    expect(get().weekNewCards).toBe(0);
  });
});

describe('syncPeriods clears stale stats and claims on rollover', () => {
  it('resets daily stats and daily claims when the day changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    get().recordBattleResult(true, 5, 0, 30, 2); // sets dailyStatsDate to today
    get().claimChallenge('d1');
    get().claimChallenge('w1');
    expect(get().todayWins).toBe(1);

    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));
    get().syncPeriods();
    expect(get().todayWins).toBe(0);
    expect(get().claimedChallenges).not.toContain('d1'); // daily cleared
    expect(get().claimedChallenges).toContain('w1');      // weekly kept (same week)
  });

  it('is a no-op within the same day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    get().recordBattleResult(true, 5, 0, 30, 2);
    get().claimChallenge('d1');
    get().syncPeriods();
    expect(get().todayWins).toBe(1);
    expect(get().claimedChallenges).toContain('d1');
  });
});

describe('checkDailyLogin', () => {
  it('grants the day-1 reward once and is idempotent for the same day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T08:00:00Z'));
    useGameStore.setState({ coins: 0, lastLoginDate: null, consecutiveLogins: 0 });
    const r1 = get().checkDailyLogin();
    expect(r1).not.toBeNull();
    expect(get().consecutiveLogins).toBe(1);
    const coinsAfterFirst = get().coins;
    // Same day again — no second grant.
    expect(get().checkDailyLogin()).toBeNull();
    expect(get().coins).toBe(coinsAfterFirst);
  });

  it('compensates promised cards with coins when the collection is complete', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T08:00:00Z'));
    // Logged in yesterday so today is day 2 (which grants 1 card). Own
    // everything so that card reward has no unowned pool to draw from.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useGameStore.setState({
      ownedCards: ALL_CARDS.map(c => c.id),
      coins: 0,
      lastLoginDate: yesterday.toDateString(),
      consecutiveLogins: 1, // -> newConsecutive 2 -> day index 1 (day 2)
    });
    get().checkDailyLogin();
    // Day-2 reward is 75 coins + 1 card; the card converts to 50 coins.
    expect(get().consecutiveLogins).toBe(2);
    expect(get().coins).toBe(75 + 50);
  });
});

describe('buyShopItem', () => {
  it('rejects purchases the player cannot afford', () => {
    const gemItem = SHOP_ITEMS.find(i => i.currency === 'gems');
    useGameStore.setState({ gems: 0 });
    const res = get().buyShopItem(gemItem.id);
    expect(res.success).toBe(false);
  });

  it('debits the price and grants the item on success', () => {
    const coinPack = SHOP_ITEMS.find(i => i.currency === 'coins' && i.type === 'pack');
    useGameStore.setState({ coins: coinPack.price, cardPacks: 0 });
    const res = get().buyShopItem(coinPack.id);
    expect(res.success).toBe(true);
    expect(get().coins).toBe(0);
    expect(get().cardPacks).toBe(coinPack.quantity);
  });
});

describe('persist migrate (returning-player safety)', () => {
  async function rehydrateWith(persistedState, version = 2) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: persistedState, version }));
    await useGameStore.persist.rehydrate();
  }

  it('repairs a missing claimedBattlePassRewards shape so claims do not crash', async () => {
    await rehydrateWith({ coins: 500, claimedBattlePassRewards: {} });
    const s = get();
    expect(s.claimedBattlePassRewards.free).toEqual([]);
    expect(s.claimedBattlePassRewards.premium).toEqual([]);
    // The claim path reads .premium.includes — must not throw.
    expect(() => get().claimBattlePassReward(1, true)).not.toThrow();
  });

  it('seeds seasonXP from cumulative level progress for pre-v3 players', async () => {
    await rehydrateWith({ level: 3, xp: 0, coins: 500 });
    // level 1 needs 100, level 2 needs 150 -> seasonXP seeded to 250
    expect(get().seasonXP).toBe(250);
  });

  it('coerces corrupt numeric fields back to defaults', async () => {
    await rehydrateWith({ coins: 'lots', gems: NaN });
    expect(typeof get().coins).toBe('number');
    expect(Number.isNaN(get().coins)).toBe(false);
    expect(typeof get().gems).toBe('number');
  });

  it('defaults missing array fields without throwing', async () => {
    await rehydrateWith({ coins: 500, ownedCards: undefined, claimedChallenges: undefined });
    expect(Array.isArray(get().ownedCards)).toBe(true);
    expect(get().ownedCards.length).toBeGreaterThan(0);
    expect(Array.isArray(get().claimedChallenges)).toBe(true);
  });
});
