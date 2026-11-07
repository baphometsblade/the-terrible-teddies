import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  useGameStore, ALL_CARDS, ACHIEVEMENTS, DAILY_REWARDS, normalizeSave, LAST_CALL_HP,
} from '@/stores/gameStore';
import { resolveLogin, weekCoinBonus, calendarGap, STREAK_CYCLE } from './loginStreak';
import { comebackFor, COMEBACK_AFTER_DAYS, COMEBACK_CAP_DAYS } from './comeback';
import { loginNotes } from './retentionCopy';
import { bookOf, COLLECTION_SETS, normalizeClaimedSets } from './collectionBook';
import { TITLES, titleById, titleForAchievement, TITLE_NAME_MAX } from './titles';
import {
  rerollPatch, visibleChallenges, normalizeRerolls, weekKeyOf,
} from './questReroll';
import { getDailyChallenges, getWeeklyChallenges, challengeProgress } from '@/stores/challenges';

const day = (y, m, d) => new Date(y, m - 1, d, 9);

describe('login streak', () => {
  it('counts local midnights, and a missing previous claim is not a gap', () => {
    expect(calendarGap(null, day(2026, 6, 10))).toBeNull();
    expect(calendarGap(day(2026, 6, 9).toDateString(), day(2026, 6, 10))).toBe(1);
    expect(calendarGap(day(2026, 6, 8).toDateString(), day(2026, 6, 10))).toBe(2);
    expect(calendarGap('not a date', day(2026, 6, 10))).toBeNull();
  });

  it('continues from yesterday, forgives exactly one missed night, and resets a longer gap', () => {
    const now = day(2026, 6, 10);
    const yesterday = day(2026, 6, 9).toDateString();
    const missed = day(2026, 6, 8).toDateString();
    expect(resolveLogin({ lastLoginDate: yesterday, consecutiveLogins: 4, streakShields: 0 }, now)).toMatchObject({
      streak: 5, day: 5, usedShield: false, broken: false,
    });
    expect(resolveLogin({ lastLoginDate: missed, consecutiveLogins: 4, streakShields: 1 }, now)).toMatchObject({
      streak: 5, day: 5, usedShield: true, shields: 0, broken: false,
    });
    // A wider gap does not spend the shield.
    expect(resolveLogin({ lastLoginDate: day(2026, 6, 7).toDateString(), consecutiveLogins: 4, streakShields: 1 }, now)).toMatchObject({
      streak: 1, day: 1, usedShield: false, shields: 1, broken: true,
    });
    expect(resolveLogin({ lastLoginDate: missed, consecutiveLogins: 4, streakShields: 0 }, now)).toMatchObject({
      streak: 1, broken: true, usedShield: false,
    });
  });

  it('banks one shield when a cycle completes, including the night that spent one', () => {
    const now = day(2026, 6, 10);
    const yesterday = day(2026, 6, 9).toDateString();
    expect(resolveLogin({ lastLoginDate: yesterday, consecutiveLogins: 6, streakShields: 0 }, now)).toMatchObject({
      streak: 7, shieldRefilled: true, shields: 1,
    });
    expect(resolveLogin({ lastLoginDate: day(2026, 6, 8).toDateString(), consecutiveLogins: 6, streakShields: 1 }, now)).toMatchObject({
      streak: 7, usedShield: true, shieldRefilled: true, shields: 1,
    });
    // Already holding one, and not finishing a cycle: still one.
    expect(resolveLogin({ lastLoginDate: yesterday, consecutiveLogins: 8, streakShields: 1 }, now).shields).toBe(1);
  });

  it('adds a quarter of the day per finished week, and stops at double', () => {
    expect(weekCoinBonus(50, 1)).toBe(0);
    expect(weekCoinBonus(50, STREAK_CYCLE)).toBe(0);
    expect(weekCoinBonus(50, STREAK_CYCLE + 1)).toBe(12);
    expect(weekCoinBonus(300, STREAK_CYCLE * 5 + 1)).toBe(300);
    expect(weekCoinBonus(300, 400)).toBe(300);
    expect(weekCoinBonus(-10, 20)).toBe(0);
  });
});

describe('comeback tab', () => {
  it('pays for an absence of three nights or more, and stops growing', () => {
    expect(comebackFor(null)).toBeNull();
    expect(comebackFor(COMEBACK_AFTER_DAYS - 1)).toBeNull();
    expect(comebackFor(COMEBACK_AFTER_DAYS)).toEqual({ days: 3, capped: false, coins: 120, packs: 0 });
    expect(comebackFor(7)).toMatchObject({ days: 7, packs: 1, coins: 280 });
    expect(comebackFor(COMEBACK_CAP_DAYS)).toMatchObject({ days: 14, capped: false, packs: 2, coins: 560 });
    expect(comebackFor(40)).toMatchObject({ days: 14, capped: true, packs: 2, coins: 560 });
  });
});

describe('login notes', () => {
  const ordinary = resolveLogin({ lastLoginDate: day(2026, 6, 9).toDateString(), consecutiveLogins: 2 }, day(2026, 6, 10));

  it('says nothing on an ordinary night', () => {
    expect(loginNotes(ordinary, 100)).toEqual([]);
  });

  it('keeps every line short, in the House’s voice', () => {
    const samples = [
      resolveLogin({ lastLoginDate: day(2026, 6, 8).toDateString(), consecutiveLogins: 6, streakShields: 1 }, day(2026, 6, 10)),
      resolveLogin({ lastLoginDate: day(2026, 6, 1).toDateString(), consecutiveLogins: 20 }, day(2026, 6, 10)),
      resolveLogin({ lastLoginDate: day(2026, 5, 1).toDateString(), consecutiveLogins: 40, streakShields: 1 }, day(2026, 6, 10)),
    ];
    for (const resolution of samples) {
      for (const line of loginNotes(resolution, 300)) {
        expect(line.length, line).toBeLessThanOrEqual(80);
        expect(line, line).not.toMatch(/!/);
        expect(line, line).not.toContain("'");
      }
    }
  });
});

describe('quest rerolls', () => {
  const date = day(2026, 6, 10);
  const blank = {
    todayWins: 0, todayBattles: 0, todayDamageDealt: 0, todayCardsPlayed: 0,
    weekWins: 0, weekBestStreak: 0, weekNewCards: 0, weekCoinsEarned: 0,
    claimedChallenges: [], questRerolls: null,
  };

  it('swaps one unfinished quest for one that was not showing, once', () => {
    const daily = getDailyChallenges(date);
    const patch = rerollPatch(blank, 'daily', daily[0].id, date);
    expect(patch.dailySwap.from).toBe(daily[0].id);
    expect(daily.map((c) => c.id)).not.toContain(patch.dailySwap.to);
    expect(patch.dailyUsed).toBe(1);
    const next = visibleChallenges({ ...blank, questRerolls: patch }, date);
    expect(next.daily.map((c) => c.id)).toContain(patch.dailySwap.to);
    expect(next.daily.map((c) => c.id)).not.toContain(daily[0].id);
    expect(next.dailyLeft).toBe(0);
    expect(rerollPatch({ ...blank, questRerolls: patch }, 'daily', patch.dailySwap.to, date)).toBeNull();
    // The same inputs land on the same replacement.
    expect(rerollPatch(blank, 'daily', daily[0].id, date)).toEqual(patch);
  });

  it('refuses a finished quest, a claimed one, and a swap from another day', () => {
    const daily = getDailyChallenges(date);
    const finished = { ...blank, todayWins: 99, todayBattles: 99, todayDamageDealt: 9999, todayCardsPlayed: 99 };
    expect(daily.every((c) => challengeProgress(c, finished) >= c.target)).toBe(true);
    expect(rerollPatch(finished, 'daily', daily[0].id, date)).toBeNull();
    expect(rerollPatch({ ...blank, claimedChallenges: [daily[1].id] }, 'daily', daily[1].id, date)).toBeNull();

    const patch = rerollPatch(blank, 'daily', daily[0].id, date);
    const tomorrow = day(2026, 6, 11);
    const later = visibleChallenges({ ...blank, questRerolls: patch }, tomorrow);
    expect(later.daily.map((c) => c.id)).toEqual(getDailyChallenges(tomorrow).map((c) => c.id));
    expect(later.dailyLeft).toBe(1);
  });

  it('keeps the weekly reroll on its own key', () => {
    const weekly = getWeeklyChallenges(date);
    const patch = rerollPatch(blank, 'weekly', weekly[0].id, date);
    expect(patch.weeklyKey).toBe(weekKeyOf(date));
    expect(patch.dailyUsed).toBe(0);
    expect(visibleChallenges({ ...blank, questRerolls: patch }, date).dailyLeft).toBe(1);
    expect(visibleChallenges({ ...blank, questRerolls: patch }, date).weeklyLeft).toBe(0);
    // Sunday and the Monday before it are one week; the next Monday is not.
    const monday = day(2026, 6, 8);
    const sunday = day(2026, 6, 14);
    const nextMonday = day(2026, 6, 15);
    expect(weekKeyOf(sunday)).toBe(weekKeyOf(monday));
    expect(weekKeyOf(nextMonday)).not.toBe(weekKeyOf(monday));
  });

  it('drops a reroll record it cannot read', () => {
    expect(normalizeRerolls(null).dailyUsed).toBe(0);
    expect(normalizeRerolls({ dailyUsed: 9, dailySwap: { from: 1, to: 'd2' } }).dailySwap).toBeNull();
    expect(normalizeRerolls({ dailyUsed: 1 }).dailyUsed).toBe(1);
  });
});

describe('collection book', () => {
  it('counts owned and missing per rarity, and only a full set is complete', () => {
    const rows = bookOf(ALL_CARDS, []);
    expect(rows.map((row) => row.id)).toEqual(COLLECTION_SETS.map((set) => set.id));
    for (const row of rows) {
      expect(row.owned).toBe(0);
      expect(row.missing).toHaveLength(row.total);
      expect(row.total).toBeGreaterThan(0);
      expect(row.complete).toBe(false);
    }
    const commons = ALL_CARDS.filter((card) => card.rarity === 'common').map((card) => card.id);
    const common = bookOf(ALL_CARDS, commons).find((row) => row.id === 'common');
    expect(common.complete).toBe(true);
    expect(common.missing).toEqual([]);
  });

  it('winks in the blurb and keeps the line short enough for a phone', () => {
    for (const set of COLLECTION_SETS) {
      expect(set.blurb.length, set.blurb).toBeGreaterThan(0);
      expect(set.blurb.length, set.blurb).toBeLessThanOrEqual(52);
      expect(set.blurb, set.blurb).not.toMatch(/!/);
      expect(set.blurb, set.blurb).not.toContain("'");
      expect(set.name, set.name).not.toMatch(/!/);
    }
    expect(new Set(COLLECTION_SETS.map((set) => set.blurb)).size).toBe(COLLECTION_SETS.length);
  });

  it('keeps only real set ids, once each', () => {
    expect(normalizeClaimedSets(['common', 'nope', 'common', 3])).toEqual(['common']);
    expect(normalizeClaimedSets(null)).toEqual([]);
  });
});

describe('house titles', () => {
  it('gives every title a short name, an achievement, and no double', () => {
    expect(new Set(TITLES.map((title) => title.id)).size).toBe(TITLES.length);
    expect(new Set(TITLES.map((title) => title.name)).size).toBe(TITLES.length);
    const achievements = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
    for (const title of TITLES) {
      expect(title.name.length, title.name).toBeLessThanOrEqual(TITLE_NAME_MAX);
      expect(title.name, title.name).not.toMatch(/!/);
      expect(achievements.has(title.achievementId), title.achievementId).toBe(true);
      expect(titleForAchievement(title.achievementId)).toBe(title);
    }
    expect(titleById('constructor')).toBeNull();
    expect(titleById('lucky').name).toBe('Lucky Bastard');
  });

  it('is the allowlist the migration will store', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261107120000_retention_house_titles.sql'),
      'utf8',
    );
    const list = sql.slice(sql.indexOf('v_title NOT IN'), sql.indexOf('THEN', sql.indexOf('v_title NOT IN')));
    const ids = [...list.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(ids).toEqual(TITLES.map((title) => title.id));
    expect(sql).toMatch(/auth\.uid\(\)/);
    expect(sql).toMatch(/SET search_path = ''/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.set_house_title\(TEXT\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/'house_title'/);
    expect(sql).toMatch(/PT429/);
  });
});

describe('the store pays the retention grants', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const claimOn = (iso, patch) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    useGameStore.setState(patch);
    return useGameStore.getState().checkDailyLogin();
  };

  it('spends a shield on one missed night and does not pay a comeback for it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(day(2026, 6, 10));
    const missed = new Date(2026, 5, 8);
    useGameStore.setState({
      coins: 0, cardPacks: 0, lastLoginDate: missed.toDateString(), consecutiveLogins: 4, streakShields: 1,
      completedAchievements: ['daily_7'],
    });
    const paid = useGameStore.getState().checkDailyLogin();
    expect(paid.usedShield).toBe(true);
    expect(paid.comeback).toBeNull();
    expect(paid.consecutive).toBe(5);
    expect(useGameStore.getState().streakShields).toBe(0);
    expect(useGameStore.getState().coins).toBe(DAILY_REWARDS[4].coins);
    expect(useGameStore.getState().checkDailyLogin()).toBeNull();
  });

  it('pays the comeback tab once when the absence is long enough, and resets the streak', () => {
    const paid = claimOn('2026-06-10T09:00:00', {
      coins: 0, cardPacks: 0, gems: 0,
      lastLoginDate: day(2026, 6, 1).toDateString(),
      consecutiveLogins: 12,
      streakShields: 1,
      completedAchievements: ['daily_7', 'daily_30'],
    });
    // 1 June to 10 June is 9 nights: under the pack threshold, over the coin one.
    expect(paid.consecutive).toBe(1);
    expect(paid.comeback).toMatchObject({ days: 9, coins: 360, packs: 1 });
    expect(paid.bonusCoins).toBe(0);
    expect(useGameStore.getState().coins).toBe(DAILY_REWARDS[0].coins + 360);
    expect(useGameStore.getState().cardPacks).toBe(1);
    // The shield was not spent on a gap it does not cover.
    expect(useGameStore.getState().streakShields).toBe(1);
    const coins = useGameStore.getState().coins;
    expect(useGameStore.getState().checkDailyLogin()).toBeNull();
    expect(useGameStore.getState().coins).toBe(coins);
  });

  it('adds the week bonus once the first week is behind', () => {
    vi.useFakeTimers();
    vi.setSystemTime(day(2026, 6, 10));
    const yesterday = new Date(2026, 5, 9);
    useGameStore.setState({
      coins: 0, cardPacks: 0,
      lastLoginDate: yesterday.toDateString(),
      consecutiveLogins: STREAK_CYCLE * 2,
      streakShields: 0,
      completedAchievements: ['daily_7', 'daily_30'],
    });
    const paid = useGameStore.getState().checkDailyLogin();
    // Streak 15 is day 1 of week 3: two finished weeks, +50% of day 1's coins.
    const base = DAILY_REWARDS[0].coins;
    expect(paid.consecutive).toBe(15);
    expect(paid.day).toBe(1);
    expect(paid.bonusCoins).toBe(Math.floor(base * 0.5));
    expect(useGameStore.getState().coins).toBe(base + paid.bonusCoins);
    expect(paid.shieldRefilled).toBe(false);
  });

  it('rerolls a quest through the store, once', () => {
    const date = new Date();
    const first = getDailyChallenges(date)[0];
    useGameStore.setState({
      todayWins: 0, todayBattles: 0, todayDamageDealt: 0, todayCardsPlayed: 0,
      dailyStatsDate: date.toDateString(), claimedChallenges: [],
    });
    const swap = useGameStore.getState().rerollQuest('daily', first.id);
    expect(swap.from).toBe(first.id);
    expect(useGameStore.getState().rerollQuest('daily', swap.to)).toBeNull();
    const showing = visibleChallenges(useGameStore.getState(), date).daily.map((c) => c.id);
    expect(showing).toContain(swap.to);
    expect(showing).not.toContain(first.id);
  });

  it('pays a completed set once, in coins and ordinary packs', () => {
    const commons = ALL_CARDS.filter((card) => card.rarity === 'common').map((card) => card.id);
    useGameStore.setState({ ownedCards: commons, coins: 0, cardPacks: 0, claimedSets: [] });
    expect(useGameStore.getState().claimCollectionSet('common')).toEqual({ coins: 250, packs: 0 });
    expect(useGameStore.getState().coins).toBe(250);
    expect(useGameStore.getState().claimCollectionSet('common')).toBeNull();
    expect(useGameStore.getState().coins).toBe(250);
    expect(useGameStore.getState().claimCollectionSet('legendary')).toBeNull();
  });

  it('wears a title only after the achievement, and takes it off', () => {
    expect(useGameStore.getState().equipTitle('lucky')).toBe(false);
    expect(useGameStore.getState().equipTitle('not-real')).toBe(false);
    useGameStore.setState({ completedAchievements: ['first_win'] });
    expect(useGameStore.getState().equipTitle('lucky')).toBe('lucky');
    expect(useGameStore.getState().equippedTitle).toBe('lucky');
    expect(useGameStore.getState().equipTitle(null)).toBeNull();
    expect(useGameStore.getState().equippedTitle).toBeNull();
  });

  it('counts last-call wins toward the third comeback', () => {
    useGameStore.getState().recordBattleResult(true, 10, 0, LAST_CALL_HP, 1, 10);
    expect(useGameStore.getState().comebackWins).toBe(1);
    expect(useGameStore.getState().completedAchievements).toContain('comeback');
    expect(useGameStore.getState().completedAchievements).not.toContain('comeback_3');
    useGameStore.getState().recordBattleResult(true, 10, 0, LAST_CALL_HP, 1, 10);
    useGameStore.getState().recordBattleResult(true, 10, 0, LAST_CALL_HP, 1, 10);
    expect(useGameStore.getState().comebackWins).toBe(3);
    expect(useGameStore.getState().completedAchievements).toContain('comeback_3');
    // A win that never reached last call does not count.
    useGameStore.getState().recordBattleResult(true, 10, 0, 30, 1, 0);
    expect(useGameStore.getState().comebackWins).toBe(3);
  });

  it('repairs a save from before these fields existed', () => {
    expect(normalizeSave({ streakShields: 9 }).streakShields).toBe(1);
    expect(normalizeSave({ streakShields: 0 }).streakShields).toBe(0);
    expect(normalizeSave({ equippedTitle: 'lucky' }).equippedTitle).toBe('lucky');
    expect(normalizeSave({ equippedTitle: 'vip' }).equippedTitle).toBeNull();
    expect(normalizeSave({ completedAchievements: ['comeback'] }).comebackWins).toBe(1);
    expect(normalizeSave({ comebackWins: 0, completedAchievements: ['comeback'] }).comebackWins).toBe(0);
    expect(normalizeSave({ claimedSets: ['rare', 'rare', 'nope'] }).claimedSets).toEqual(['rare']);
    expect(normalizeSave({ questRerolls: { dailyUsed: 1, dailySwap: { from: 'd1', to: 'd1' } } }).questRerolls.dailySwap).toBeNull();
  });
});
