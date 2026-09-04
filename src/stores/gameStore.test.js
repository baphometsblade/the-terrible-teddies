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

describe('leaderboard experience mapping', () => {
  // Mirrors Leaderboard.jsx's calculateLevel — a rival row derives its level
  // from players.experience this way. getLeaderboardExperience must round-trip
  // through it, or every rival reads as Level 1 (the bug: experience was never
  // written, so it stayed 0 → floor(0/100)+1 → 1).
  const calculateLevel = (experience) => Math.floor((experience || 0) / 100) + 1;

  it('round-trips the store level through the leaderboard formula', () => {
    for (const level of [1, 2, 5, 12, 40, 100]) {
      useGameStore.setState({ level, xp: 0 });
      const exp = get().getLeaderboardExperience();
      expect(calculateLevel(exp), `level ${level}`).toBe(level);
    }
  });

  it('within-level xp advances experience without crossing a level boundary', () => {
    useGameStore.setState({ level: 5, xp: 0 });
    const floor = get().getLeaderboardExperience();
    useGameStore.setState({ level: 5, xp: 10_000 }); // well past this level's need
    const high = get().getLeaderboardExperience();
    expect(high).toBeGreaterThan(floor);
    expect(calculateLevel(high)).toBe(5); // still Level 5, never bleeds into 6
  });

  it('never exceeds sync_player_level’s 10000 clamp', () => {
    useGameStore.setState({ level: 100, xp: 10_000 });
    expect(get().getLeaderboardExperience()).toBeLessThan(10_000);
  });
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

  // reverse_gem_purchase (migration 20260718000200) debits user_gems on a refund
  // or chargeback. It is the ONLY thing that moves the server total down —
  // every other writer is additive and spending never leaves the client — so a
  // negative delta means a payment was reversed and must reach the balance the
  // game actually spends from. It used to move only the high-water mark, which
  // left every clawed-back gem fully spendable.
  it('applies a refund/chargeback clawback to the spendable balance', () => {
    useGameStore.setState({ gems: 10, lastSyncedServerGems: 0 });
    get().reconcileServerGems(500);   // bought 500: gems 510, mark 500
    expect(get().gems).toBe(510);

    get().reconcileServerGems(0);     // charged back: server debits to 0
    expect(get().gems).toBe(10);      // only the 10 they earned in-game remain
    expect(get().lastSyncedServerGems).toBe(0);
  });

  it('floors the clawback at zero when the gems were already spent', () => {
    useGameStore.setState({ gems: 0, lastSyncedServerGems: 0 });
    get().reconcileServerGems(500);   // gems 500
    get().spendGems(450);             // gems 50
    get().reconcileServerGems(0);     // clawback of 500 against a balance of 50
    expect(get().gems).toBe(0);       // floored, exactly as the server's GREATEST(gems - v, 0)
  });

  it('does not let a buy-chargeback cycle net free gems on repeat', () => {
    useGameStore.setState({ gems: 0, lastSyncedServerGems: 0 });
    get().reconcileServerGems(500);   // buy
    get().reconcileServerGems(0);     // chargeback
    expect(get().gems).toBe(0);
    get().reconcileServerGems(500);   // buy again
    expect(get().gems).toBe(500);     // 500, not 1000
    get().reconcileServerGems(0);
    expect(get().gems).toBe(0);
  });

  // A shared device on a slow connection: player A's balance request is still
  // in flight when A signs out and B signs in. bindToUser(B) wipes the save;
  // A's response then resolves. Unguarded it credited B with the gems A paid
  // for and set B's mark to A's total, so B's own purchase then credited
  // nothing — "paid real money and received nothing", the exact failure
  // bindToUser exists to prevent, reintroduced through the async tail.
  it('drops a balance that was read for a different account', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    const B = '22222222-2222-4222-8222-222222222222';

    useGameStore.setState({ ownerUserId: A, gems: 0, lastSyncedServerGems: 0 });
    get().bindToUser(B);                    // A signs out, B signs in — save wiped
    expect(get().ownerUserId).toBe(B);

    // B's save is fresh, so it holds the starting grant and nothing else.
    const fresh = get().gems;

    get().reconcileServerGems(500, A);      // A's in-flight response lands late
    expect(get().gems).toBe(fresh);         // B is not handed A's purchase
    expect(get().lastSyncedServerGems).toBe(0);   // ...nor A's high-water mark

    get().reconcileServerGems(500, B);      // B's own purchase still credits
    expect(get().gems).toBe(fresh + 500);
  });

  it('still applies a balance read for the current owner', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    useGameStore.setState({ ownerUserId: A, gems: 10, lastSyncedServerGems: 0 });
    get().reconcileServerGems(100, A);
    expect(get().gems).toBe(110);
  });

  // PurchaseSuccess calls this with one argument; the guard must not change
  // behaviour when no account is named.
  it('applies unguarded when no account is passed', () => {
    useGameStore.setState({ ownerUserId: 'someone', gems: 0, lastSyncedServerGems: 0 });
    get().reconcileServerGems(250);
    expect(get().gems).toBe(250);
  });

  it('credits only the delta on a second purchase', () => {
    useGameStore.setState({ gems: 0, lastSyncedServerGems: 0 });
    get().reconcileServerGems(100); // +100
    get().reconcileServerGems(150); // +50 only
    expect(get().gems).toBe(150);
    expect(get().lastSyncedServerGems).toBe(150);
  });

  // This used to assert the opposite — "a downward server move only tracks the
  // mark, never debits" — and that assertion was correct when it was written on
  // 2026-06-27, next to a source comment reading "Server total moved down
  // (shouldn't happen)". reverse_gem_purchase landed on 2026-07-18 and made it
  // happen on purpose, on every refund and every chargeback. The test was never
  // revisited, so for three weeks it actively defended the hole the migration
  // was written to close. A partial debit is the ordinary shape of that event:
  // the player bought 150, earned 50 in-game, and had 30 of the purchase
  // reversed.
  it('debits a partial reversal and leaves in-game earnings alone', () => {
    useGameStore.setState({ gems: 200, lastSyncedServerGems: 150 });
    get().reconcileServerGems(120);
    expect(get().gems).toBe(170);
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

describe('syncSeason — battle pass rollover', () => {
  it('grandfathers un-stamped progress only while Season 1 is still current', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    useGameStore.setState({ seasonKey: null, seasonXP: 400, hasBattlePassPremium: true });
    get().syncSeason();
    expect(get().seasonKey).toBe('season-1');
    expect(get().seasonXP).toBe(400); // grandfathered, not reset
    expect(get().hasBattlePassPremium).toBe(true);
  });

  it('resets un-stamped LEGACY progress once the calendar is past Season 1', () => {
    // A pre-rollover save (seasonKey null) whose progress was earned under the
    // original hardcoded Season 1, loaded during Season 2 — the progress must
    // NOT attach to the new season (instant tiers + carried-over premium).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
    useGameStore.setState({
      seasonKey: null,
      seasonXP: 2700,
      hasBattlePassPremium: true,
      claimedBattlePassRewards: { free: [1], premium: [1] },
    });
    get().syncSeason();
    expect(get().seasonKey).toBe('season-2');
    expect(get().seasonXP).toBe(0);
    expect(get().hasBattlePassPremium).toBe(false);
    expect(get().claimedBattlePassRewards).toEqual({ free: [], premium: [] });
  });

  it('stamps a fresh player (no progress) without a pointless reset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
    useGameStore.setState({ seasonKey: null, seasonXP: 0, hasBattlePassPremium: false });
    get().syncSeason();
    expect(get().seasonKey).toBe('season-2');
  });

  it('resets progress, claims, and premium when the season advances', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    get().syncSeason(); // stamps season-1
    useGameStore.setState({
      seasonXP: 1500,
      hasBattlePassPremium: true,
      claimedBattlePassRewards: { free: [1, 2, 3], premium: [1, 2] },
    });

    vi.setSystemTime(new Date('2026-07-04T12:00:00Z')); // season-2
    get().syncSeason();
    expect(get().seasonKey).toBe('season-2');
    expect(get().seasonXP).toBe(0);
    expect(get().hasBattlePassPremium).toBe(false);
    expect(get().claimedBattlePassRewards).toEqual({ free: [], premium: [] });
  });

  it('is a no-op within the same season', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
    get().syncSeason();
    useGameStore.setState({ seasonXP: 300 });
    get().syncSeason();
    expect(get().seasonXP).toBe(300);
  });

  it('addXP rolls the season before crediting, so XP lands in the new season', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    get().syncSeason();
    useGameStore.setState({ seasonXP: 1500, xp: 0, level: 1 });

    vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
    get().addXP(50);
    expect(get().seasonKey).toBe('season-2');
    expect(get().seasonXP).toBe(50); // reset to 0, then credited 50
  });
});

describe('claimBattlePassReward is atomic per tier/track with store-side eligibility', () => {
  it('blocks a second claim of the same tier+track', () => {
    get().syncSeason(); // stamp the current season before granting progress
    useGameStore.setState({ hasBattlePassPremium: true });
    expect(get().claimBattlePassReward(3, false)).toBe(true);
    expect(get().claimBattlePassReward(3, false)).toBe(false);
    // The premium track of the same tier is independent.
    expect(get().claimBattlePassReward(3, true)).toBe(true);
  });

  it('rejects claims above the earned XP and premium claims without the pass', () => {
    get().syncSeason();
    useGameStore.setState({ seasonXP: 100 });
    expect(get().claimBattlePassReward(5, false, 700)).toBe(false); // tier not reached
    expect(get().claimBattlePassReward(2, false, 100)).toBe(true);  // exactly reached
    expect(get().claimBattlePassReward(2, true, 100)).toBe(false);  // no premium pass
  });
});

describe('addXP — leveling and monotonic seasonXP', () => {
  it('levels up, carries remainder, and grows seasonXP by the full amount', () => {
    useGameStore.setState({ xp: 0, level: 1, seasonXP: 0, coins: 0 });
    get().addXP(250); // level 1 needs 100, level 2 needs 150 -> reaches level 3, 0 remainder
    expect(get().level).toBe(3);
    expect(get().seasonXP).toBe(250);
    // Each level-up pays a 100*newLevel coin bonus: +200 reaching L2, +300
    // reaching L3 = 500. This was previously unasserted, so a regression in the
    // bonus formula would pass silently.
    expect(get().coins).toBe(500);
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
  it('on a win pays exactly 25 + streak*5 coins', () => {
    // Assert the EXACT battle payout, not just "> 0". The old >= assertion
    // survived deleting `if (won) addCoins(coinsThisBattle)` entirely, because
    // the flawless-win achievement (finalHP 30, no damage) adds 1000 coins and
    // masked the missing battle reward. So: take a NON-flawless result (finalHP
    // 20, 10 damage taken -> no perfect_win, no comeback) and pre-complete the
    // win/battle-count achievements so nothing else moves the balance.
    useGameStore.setState({
      totalWins: 100, totalBattles: 200, currentWinStreak: 0, coins: 0,
      completedAchievements: ['first_win', 'win_10', 'win_50', 'win_streak_5', 'play_100'],
      dailyStatsDate: new Date().toDateString(), weeklyStatsDate: 'x',
    });
    const before = get().coins;
    const res = get().recordBattleResult(true, 10, 0, 20, 3, 10);

    expect(get().totalWins).toBe(101);
    expect(get().currentWinStreak).toBe(1);
    expect(res.coinsGain).toBe(30);              // 25 + newStreak(1)*5
    expect(get().coins - before).toBe(30);       // nothing else touched the balance
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

  it('does not fold a streak carried from a prior week into weekBestStreak', () => {
    // The exploit: weekBestStreak was Math.max(prev, currentWinStreak+1), and
    // currentWinStreak is the ALL-TIME cross-week streak. A player entering a new
    // week mid-streak would satisfy the w4/w5 streak challenges (targets 3/5)
    // after a single win, re-claiming their pack rewards weekly for one game.
    useGameStore.setState({
      currentWinStreak: 6,        // long streak carried from last week
      weekStreak: 0, weekBestStreak: 0,
      weeklyStatsDate: 'prior-week', // != this week's key -> weeklyReset fires
    });
    get().recordBattleResult(true, 0, 0, 30, 1); // one win this week
    expect(get().currentWinStreak).toBe(7); // all-time streak still advances
    expect(get().weekBestStreak).toBe(1);   // but the WEEKLY best is 1, not 7
  });

  // The test above seeds weekStreak/weekBestStreak at 0 BEFORE the rollover, so
  // it passes whether or not the rollover actually zeroes them — which left the
  // `weeklyReset ? 0 :` guards on both values completely uncovered. Deleting
  // them kept all 361 tests green, and an audit probe did exactly that; the
  // deletion was then swept into a docs commit and shipped to main. This is the
  // case that was missing: last week's values are non-zero going in.
  it('drops LAST week\'s streak values at the rollover, not just a zeroed pair', () => {
    useGameStore.setState({
      weekStreak: 6,          // still running from last week
      weekBestStreak: 6,      // and last week's best
      weeklyStatsDate: 'prior-week',
    });
    get().recordBattleResult(true, 0, 0, 30, 1); // first win of the NEW week

    // Both must restart from this week's single win. Carrying 6 across the
    // Monday boundary completes w4 (3-streak, 2 packs) and w5 (5-streak, 3
    // packs) off one game, every week, forever.
    expect(get().weekStreak).toBe(1);
    expect(get().weekBestStreak).toBe(1);
  });

  it('resets the weekly streak on a loss but keeps the weekly best', () => {
    useGameStore.setState({ weekStreak: 0, weekBestStreak: 0, weeklyStatsDate: 'prior-week' });
    get().recordBattleResult(true, 0, 0, 30, 1);
    get().recordBattleResult(true, 0, 0, 30, 1);
    expect(get().weekStreak).toBe(2);
    expect(get().weekBestStreak).toBe(2);
    get().recordBattleResult(false, 0, 0, 0, 1); // a loss
    expect(get().weekStreak).toBe(0);            // running streak resets
    expect(get().weekBestStreak).toBe(2);        // but the best this week stands
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

  it('reports the cards it actually granted, not the ones it promised', () => {
    // The claim panel renders whatever this returns. Card rewards can only draw
    // from cards the player doesn't own, and any shortfall is paid as coins —
    // so a complete collection used to see "+2 cards" for a grant of zero.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T08:00:00Z'));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useGameStore.setState({
      ownedCards: ALL_CARDS.map((c) => c.id), // nothing left to draw
      coins: 0,
      lastLoginDate: yesterday.toDateString(),
      consecutiveLogins: 1, // -> day 2, which promises 1 card
    });

    const reward = get().checkDailyLogin();
    expect(reward.day).toBe(2);
    expect(reward.cards).toBe(0);            // truthful: none were granted
    expect(reward.substitutedCards).toBe(1); // and it says what was swapped
    // The coins it reports include the substitution, matching the real balance.
    expect(reward.coins).toBe(get().coins);
  });

  it('grants the gem and pack rewards on a day that awards them (day 7)', () => {
    // The two tests above only cover coin/card grants, so a regression that
    // dropped the gem or pack credit would pass. Streak of 6 -> today is day 7,
    // which awards 300 coins + 25 gems + 2 packs.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T08:00:00Z'));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useGameStore.setState({
      coins: 0, gems: 0, cardPacks: 0,
      lastLoginDate: yesterday.toDateString(),
      consecutiveLogins: 6, // -> newConsecutive 7 -> day 7
    });
    const reward = get().checkDailyLogin();
    expect(reward.day).toBe(7);
    expect(get().consecutiveLogins).toBe(7);
    // The gem and pack grants are the point of this test — nothing else touches
    // them, so these are exact.
    expect(get().gems).toBe(25);
    expect(get().cardPacks).toBe(2);
    // Coins get the 300 day-7 reward plus the 'daily_7' achievement bonus that a
    // 7-day streak also unlocks, so assert the reward landed as a lower bound.
    expect(get().coins).toBeGreaterThanOrEqual(300);
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

describe('Coin Doubler booster', () => {
  const HOUR = 60 * 60 * 1000;
  const doubler = SHOP_ITEMS.find((i) => i.id === 'coin_doubler');

  it('is a real purchasable item, not a placeholder', () => {
    // It shipped as an advertised card behind a disabled "Coming Soon" button.
    expect(doubler).toBeDefined();
    expect(doubler.currency).toBe('gems');
    expect(doubler.durationHours).toBeGreaterThan(0);
  });

  it('refuses the purchase and changes nothing when gems are short', () => {
    useGameStore.setState({ gems: doubler.price - 1, coinDoublerExpiresAt: null });
    expect(get().buyShopItem('coin_doubler').success).toBe(false);
    expect(get().gems).toBe(doubler.price - 1);
    expect(get().coinDoublerExpiresAt).toBeNull();
    expect(get().isCoinDoublerActive()).toBe(false);
  });

  it('debits gems and opens the window on purchase', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    useGameStore.setState({ gems: 100, coinDoublerExpiresAt: null });

    expect(get().buyShopItem('coin_doubler').success).toBe(true);
    expect(get().gems).toBe(100 - doubler.price);
    expect(get().isCoinDoublerActive()).toBe(true);
    expect(get().coinDoublerExpiresAt).toBe(Date.now() + doubler.durationHours * HOUR);
  });

  it('doubles battle coins while active, and stops when the window lapses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    // Assert on weekCoinsEarned: it accumulates exactly the battle payout,
    // whereas the raw coins balance also absorbs one-off achievement and
    // level-up bonuses that would mask the multiplier.
    const payoutOf = (opts) => {
      useGameStore.setState({ weekCoinsEarned: 0, currentWinStreak: 0, weeklyStatsDate: 'x', ...opts });
      get().recordBattleResult(true, 0, 0, 30, 1);
      return get().weekCoinsEarned;
    };

    // Base rate for a first win: 25 + streak(1)*5 = 30.
    expect(payoutOf({ coinDoublerExpiresAt: null })).toBe(30);
    // Same battle shape with the booster running pays double.
    expect(payoutOf({ coinDoublerExpiresAt: Date.now() + 2 * HOUR })).toBe(60);

    // Past the expiry it is inert again — no timer, purely timestamp-driven.
    const expiry = Date.now() + 2 * HOUR;
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));
    expect(payoutOf({ coinDoublerExpiresAt: expiry })).toBe(30);
    expect(get().isCoinDoublerActive()).toBe(false);
  });

  it('keeps the weekly coin total equal to what was actually granted', () => {
    // weekCoinsEarned drives a weekly challenge, so it must track the real
    // payout. A hardcoded consolation grant used to sit beside the tracked
    // figure and would drift the moment any multiplier applied.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useGameStore.setState({
      coins: 0, weekCoinsEarned: 0, weeklyStatsDate: 'prior-week',
      coinDoublerExpiresAt: Date.now() + HOUR,
    });
    get().recordBattleResult(false, 0, 0, 0, 1); // a LOSS: consolation payout
    expect(get().coins).toBe(get().weekCoinsEarned);
    expect(get().coins).toBe(10); // 5 consolation, doubled
  });

  it('extends an already-running booster instead of truncating it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    useGameStore.setState({ gems: 500, coinDoublerExpiresAt: null });
    get().buyShopItem('coin_doubler');
    const afterFirst = get().coinDoublerExpiresAt;

    // Buying again a hour later must ADD a full window to the remaining time,
    // not restart from now (which would burn the hours already paid for).
    vi.setSystemTime(new Date('2026-06-01T13:00:00Z'));
    get().buyShopItem('coin_doubler');
    expect(get().coinDoublerExpiresAt).toBe(afterFirst + doubler.durationHours * HOUR);
    expect(get().coinDoublerHoursLeft()).toBe(2 * doubler.durationHours - 1);
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

  it('coerces corrupt numeric fields back to their concrete defaults', async () => {
    // A string ('lots') and a real NaN — both must land on the initialState
    // default, not merely "some number". The old assertions only checked the
    // type, so a coercion that produced NaN or left the string would have passed
    // (NaN is typeof 'number'); this pins the actual repaired values.
    await rehydrateWith({ coins: 'lots', gems: NaN, xp: 'x', level: NaN });
    expect(get().coins).toBe(500);   // initialState.coins
    expect(get().gems).toBe(10);     // initialState.gems
    expect(Number.isNaN(get().gems)).toBe(false);
    expect(get().level).toBe(1);     // initialState.level — NaN must not survive
    expect(Number.isNaN(get().xp)).toBe(false);
  });

  it('defaults missing array fields without throwing', async () => {
    await rehydrateWith({ coins: 500, ownedCards: undefined, claimedChallenges: undefined });
    expect(Array.isArray(get().ownedCards)).toBe(true);
    expect(get().ownedCards.length).toBeGreaterThan(0);
    expect(Array.isArray(get().claimedChallenges)).toBe(true);
  });
});

describe('resetProgress keeps the server-gem high-water mark', () => {
  // The exploit this closes: resetProgress used to restore the whole
  // initialState, including lastSyncedServerGems: 0. The mark records how much
  // purchased currency has already been credited locally, so zeroing it made
  // the next login's reconcileServerGems see the player's entire purchase
  // history as a fresh positive delta and credit it again. Reset, relog,
  // collect — repeatable, so a single real purchase mints gems forever.
  it('does not re-credit a purchase history that was already granted', () => {
    // Player buys 500 gems: the webhook credits the server, the client syncs.
    get().reconcileServerGems(500);
    expect(get().gems).toBe(510); // 10 starting + 500 purchased
    expect(get().lastSyncedServerGems).toBe(500);

    // They spend the lot, then wipe their progress.
    get().spendGems(510);
    expect(get().gems).toBe(0);
    get().resetProgress();

    // Next login re-reads the same authoritative server total. The server has
    // not sold them anything new, so nothing may be credited.
    const afterReset = get().gems;
    get().reconcileServerGems(500);
    expect(get().gems).toBe(afterReset);
    expect(get().lastSyncedServerGems).toBe(500);
  });

  it('still credits a genuine purchase made after a reset', () => {
    get().reconcileServerGems(500);
    get().resetProgress();
    const afterReset = get().gems;

    // A real second purchase raises the server total to 800.
    get().reconcileServerGems(800);
    expect(get().gems).toBe(afterReset + 300); // only the new 300, not all 800
  });

  it('resets everything else it is supposed to', () => {
    useGameStore.setState({ coins: 99999, totalWins: 42, level: 7 });
    get().resetProgress();
    expect(get().coins).toBe(500);
    expect(get().totalWins).toBe(0);
    expect(get().level).toBe(1);
  });

  it('keeps the save bound to the current account (does not null ownerUserId)', () => {
    // Nulling the owner would leave an "unowned" save carrying this player's
    // high-water mark, which the next different account would ADOPT (keep)
    // rather than wipe.
    const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    useGameStore.setState({ ownerUserId: A });
    get().resetProgress();
    expect(get().ownerUserId).toBe(A);
  });

  it("a different account after a reset wipes the mark, so its first purchase credits in full", () => {
    // The regression: reset nulled ownerUserId while keeping lastSyncedServerGems,
    // so account B adopted A's mark and B's real purchase credited 0.
    const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    get().bindToUser(A);
    get().reconcileServerGems(500); // A's mark is now 500
    get().resetProgress();

    // B signs in on the same device: different owner -> wipe branch -> mark zeroed.
    get().bindToUser(B);
    expect(get().lastSyncedServerGems).toBe(0);
    const before = get().gems;
    get().reconcileServerGems(500); // B's own $9.99 bundle -> server total 500
    expect(get().gems).toBe(before + 500); // credited in full, not swallowed
  });
});

describe('purchaseBattlePassPremium is atomic', () => {
  // Split as `if (spendGems(price)) setBattlePassPremium(true)` in the
  // component, two clicks landing before React re-renders both read
  // hasBattlePassPremium as false from the same closure while spendGems reads
  // live store state — so a player holding 1000 gems paid 1000 for one pass.
  it('a double-click charges once, not twice', () => {
    useGameStore.setState({ gems: 1000, hasBattlePassPremium: false });

    expect(get().purchaseBattlePassPremium(500)).toBe('purchased');
    expect(get().purchaseBattlePassPremium(500)).toBe('already-owned');

    expect(get().gems).toBe(500); // charged exactly once
    expect(get().hasBattlePassPremium).toBe(true);
  });

  it('refuses and charges nothing when the player cannot afford it', () => {
    useGameStore.setState({ gems: 499, hasBattlePassPremium: false });
    expect(get().purchaseBattlePassPremium(500)).toBe('insufficient-gems');
    expect(get().gems).toBe(499);
    expect(get().hasBattlePassPremium).toBe(false);
  });

  it('debits exactly the price on a successful buy', () => {
    useGameStore.setState({ gems: 500, hasBattlePassPremium: false });
    expect(get().purchaseBattlePassPremium(500)).toBe('purchased');
    expect(get().gems).toBe(0);
  });
});

describe("'Flawless' keys off damage taken, not final HP", () => {
  // The bug: perfect_win fired on `won && finalHP === 30`. Healing is capped at
  // 30, so a player who got hit for 12 and healed back to full finished the
  // battle at 30 and claimed "Win without losing HP".
  it('does not award Flawless for a win that took damage but healed back to full', () => {
    useGameStore.setState({ completedAchievements: [] });
    // won, damageDealt, healingDone, finalHP=30 (healed back), cardsPlayed, damageTaken=12
    get().recordBattleResult(true, 20, 12, 30, 4, 12);
    expect(get().completedAchievements).not.toContain('perfect_win');
  });

  it('awards Flawless for a genuinely untouched win', () => {
    useGameStore.setState({ completedAchievements: [] });
    get().recordBattleResult(true, 30, 0, 30, 4, 0);
    expect(get().completedAchievements).toContain('perfect_win');
  });

  it('never awards Flawless on a loss', () => {
    useGameStore.setState({ completedAchievements: [] });
    get().recordBattleResult(false, 0, 0, 30, 1, 0);
    expect(get().completedAchievements).not.toContain('perfect_win');
  });
});

describe('bindToUser isolates saves per account on a shared device', () => {
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';

  // The store persists to ONE device-wide localStorage key and sign-out clears
  // nothing, so a second account inherited the first player's progress — and
  // their lastSyncedServerGems mark, which silently broke the newcomer's
  // purchases.
  it("a different account does not inherit the previous player's progress", () => {
    get().bindToUser(A);
    useGameStore.setState({ coins: 99999, totalWins: 40, ownedCards: [1, 2, 3, 4, 5] });

    get().bindToUser(B);
    expect(get().coins).toBe(500);      // initialState, not A's hoard
    expect(get().totalWins).toBe(0);
    expect(get().ownerUserId).toBe(B);
  });

  it("a newcomer's purchase credits in full rather than being swallowed by the previous player's high-water mark", () => {
    // Player A buys 500 gems on this device.
    get().bindToUser(A);
    get().reconcileServerGems(500);
    expect(get().lastSyncedServerGems).toBe(500);

    // Player B signs in on the same device and buys 500 gems of their own.
    get().bindToUser(B);
    const before = get().gems;
    get().reconcileServerGems(500);

    // Without the reset, delta would be 500 - 500 = 0: B pays and gets nothing.
    expect(get().gems).toBe(before + 500);
  });

  it('the same account signing back in keeps its progress', () => {
    get().bindToUser(A);
    useGameStore.setState({ coins: 4242, totalWins: 7 });
    get().bindToUser(A);
    expect(get().coins).toBe(4242);
    expect(get().totalWins).toBe(7);
  });

  it('adopts a pre-existing unowned save instead of wiping it', () => {
    // A save from before ownerUserId existed.
    useGameStore.setState({ ownerUserId: null, coins: 8888 });
    get().bindToUser(A);
    expect(get().coins).toBe(8888);
    expect(get().ownerUserId).toBe(A);
  });

  it('signing out (no user id) leaves the save alone', () => {
    get().bindToUser(A);
    useGameStore.setState({ coins: 1234 });
    get().bindToUser(undefined);
    expect(get().coins).toBe(1234);
    expect(get().ownerUserId).toBe(A);
  });
});

describe('premium Battle Pass exclusive tiers grant a real entitlement', () => {
  // The bug: claiming an 'exclusive' tier (border/emote) recorded the tier as
  // claimed and showed a toast but granted NOTHING — a player who paid 500 gems
  // for premium got an empty claim. unlockCosmetic now records it.
  it('unlockCosmetic records a cosmetic and is idempotent', () => {
    useGameStore.setState({ unlockedCosmetics: [] });
    get().unlockCosmetic('Gold Border');
    get().unlockCosmetic('Gold Border'); // repeat click
    get().unlockCosmetic('Teddy Emote');
    expect(get().unlockedCosmetics).toEqual(['Gold Border', 'Teddy Emote']);
  });

  it('ignores an empty name', () => {
    useGameStore.setState({ unlockedCosmetics: [] });
    get().unlockCosmetic('');
    get().unlockCosmetic(undefined);
    expect(get().unlockedCosmetics).toEqual([]);
  });
});

describe('weekNewCards is reset-aware (no permanent "Collect N New Cards")', () => {
  afterEach(() => vi.useRealTimers());

  // The bug: addCards bumped weekNewCards, but a player who only collects cards
  // (never battles) had weeklyStatsDate stuck at null, so syncPeriods
  // early-returned and the counter never reset across real week boundaries —
  // leaving the weekly challenge permanently satisfied and re-claimable.
  it('anchors the week on first addCards and resets the counter across a real week boundary', () => {
    vi.useFakeTimers();
    // A Monday.
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    useGameStore.setState({ ownedCards: [], weekNewCards: 0, weeklyStatsDate: null, claimedChallenges: [] });

    get().addCards([1, 2, 3, 4, 5]);
    expect(get().weekNewCards).toBe(5);
    expect(get().weeklyStatsDate).not.toBeNull(); // anchored, so a rollover can be detected

    // Next week: collecting again must count toward the fresh week, not stack.
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    get().addCards([6, 7]);
    expect(get().weekNewCards).toBe(2); // reset to 0 on rollover, then +2 — NOT 7
  });

  it('same-week collection keeps accumulating', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    useGameStore.setState({ ownedCards: [], weekNewCards: 0, weeklyStatsDate: null });
    get().addCards([1, 2]);
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z')); // same week
    get().addCards([3, 4]);
    expect(get().weekNewCards).toBe(4);
  });
});
