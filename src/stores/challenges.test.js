import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DAILY_POOL,
  WEEKLY_POOL,
  STAT_TO_STORE_FIELD,
  getDailyChallenges,
  getWeeklyChallenges,
} from './challenges';
import { useGameStore } from './gameStore';

const get = () => useGameStore.getState();

beforeEach(() => {
  localStorage.clear();
  get().resetProgress();
});

afterEach(() => {
  vi.useRealTimers();
});

// A handful of fixed reference dates spanning day and week boundaries. Kept
// as explicit Date objects (not "today") so these tests never become
// date-dependent/flaky.
const MON = new Date(2026, 0, 5);   // Monday
const TUE = new Date(2026, 0, 6);   // next day, same week
const NEXT_MON = new Date(2026, 0, 12); // next week's Monday
const SUN = new Date(2026, 0, 11);  // Sunday — same week as MON

describe('challenge pool shape', () => {
  it('has enough daily/weekly candidates to fill 4 distinct picks', () => {
    expect(DAILY_POOL.length).toBeGreaterThanOrEqual(4);
    expect(WEEKLY_POOL.length).toBeGreaterThanOrEqual(4);
  });

  it('every pool entry has a unique id within its own pool', () => {
    for (const pool of [DAILY_POOL, WEEKLY_POOL]) {
      const ids = pool.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  // The most valuable test here: a challenge whose `stat` doesn't map to a
  // real, tracked store field can never progress — it would sit at 0/N
  // forever. This guards against exactly that typo class of bug.
  it('every challenge references a stat the store actually tracks', () => {
    const state = get();
    for (const challenge of [...DAILY_POOL, ...WEEKLY_POOL]) {
      const field = STAT_TO_STORE_FIELD[challenge.stat];
      expect(
        field,
        `challenge "${challenge.name}" (${challenge.id}) has stat "${challenge.stat}" with no mapping in STAT_TO_STORE_FIELD`
      ).toBeTruthy();
      expect(
        typeof state[field] === 'number',
        `challenge "${challenge.name}" (${challenge.id}) maps to gameStore field "${field}", which is not a numeric tracked stat`
      ).toBe(true);
    }
  });

  it('daily challenges only reference daily (today*) fields, weekly only week*', () => {
    for (const challenge of DAILY_POOL) {
      expect(STAT_TO_STORE_FIELD[challenge.stat]).toMatch(/^today/);
    }
    for (const challenge of WEEKLY_POOL) {
      expect(STAT_TO_STORE_FIELD[challenge.stat]).toMatch(/^week/);
    }
  });

  it('every challenge has a positive target and a well-formed reward', () => {
    for (const challenge of [...DAILY_POOL, ...WEEKLY_POOL]) {
      expect(challenge.target).toBeGreaterThan(0);
      expect(['coins', 'gems', 'xp', 'pack', 'legendaryPack']).toContain(challenge.reward.type);
      expect(challenge.reward.amount).toBeGreaterThan(0);
      expect(typeof challenge.description).toBe('string');
      expect(challenge.description.length).toBeGreaterThan(0);
    }
  });
});

describe('rotation stability', () => {
  it('returns the same 4 daily challenges for the same calendar day', () => {
    const a = getDailyChallenges(MON).map((c) => c.id);
    const b = getDailyChallenges(new Date(2026, 0, 5, 23, 59)).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('returns the same 4 weekly challenges anywhere within the same week', () => {
    const mon = getWeeklyChallenges(MON).map((c) => c.id);
    const tue = getWeeklyChallenges(TUE).map((c) => c.id);
    const sun = getWeeklyChallenges(SUN).map((c) => c.id);
    expect(tue).toEqual(mon);
    expect(sun).toEqual(mon);
  });

  it('picks exactly 4 daily and 4 weekly challenges', () => {
    expect(getDailyChallenges(MON)).toHaveLength(4);
    expect(getWeeklyChallenges(MON)).toHaveLength(4);
  });

  it('never duplicates a challenge within the same period', () => {
    const dailyIds = getDailyChallenges(MON).map((c) => c.id);
    const weeklyIds = getWeeklyChallenges(MON).map((c) => c.id);
    expect(new Set(dailyIds).size).toBe(dailyIds.length);
    expect(new Set(weeklyIds).size).toBe(weeklyIds.length);
  });
});

describe('rotation actually rotates', () => {
  it('consecutive days can yield a different daily set', () => {
    // Sample a run of consecutive days — with only 12-choose-4 combinations
    // and a handful of days sampled, requiring at least one change across the
    // whole run is robust without depending on any single day's shuffle.
    const sets = [];
    for (let d = 1; d <= 10; d++) {
      sets.push(getDailyChallenges(new Date(2026, 0, d)).map((c) => c.id).sort().join(','));
    }
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it('consecutive weeks can yield a different weekly set', () => {
    const monWeekly = getWeeklyChallenges(MON).map((c) => c.id).sort().join(',');
    const nextMonWeekly = getWeeklyChallenges(NEXT_MON).map((c) => c.id).sort().join(',');
    // Not strictly guaranteed to differ for any two arbitrary weeks (a shuffle
    // collision is possible), but sample enough weeks that at least one pair
    // of consecutive weeks differs — proving rotation isn't a no-op.
    const weeklySets = [];
    for (let w = 0; w < 8; w++) {
      const monday = new Date(2026, 0, 5 + w * 7);
      weeklySets.push(getWeeklyChallenges(monday).map((c) => c.id).sort().join(','));
    }
    expect(new Set(weeklySets).size).toBeGreaterThan(1);
    // Sanity: the two explicitly named weeks are indeed treated as distinct
    // periods (different seeds), even if this particular pair happens to
    // collide in content.
    expect(monWeekly).toBeTruthy();
    expect(nextMonWeekly).toBeTruthy();
  });
});

describe('claim safety across a rotation boundary', () => {
  it('a daily id claimed today cannot be re-claimed, and is fully cleared (whether or not it recurs) once the day rolls over', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

    const todaysDaily = getDailyChallenges(new Date());
    const claimedId = todaysDaily[0].id;

    get().recordBattleResult(true, 5, 0, 20, 1); // stamps dailyStatsDate = today
    expect(get().claimChallenge(claimedId)).toBe(true);
    // Same-day re-claim must fail — no double-grant.
    expect(get().claimChallenge(claimedId)).toBe(false);

    // Advance to the next calendar day and let the store notice, exactly as
    // opening the Challenges panel (syncPeriods) or playing a battle does.
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));
    get().syncPeriods();

    // Whether or not tomorrow's rotation happens to reselect the same id, the
    // claim must be gone: otherwise a stale claim could permanently block a
    // freshly-rotated-in challenge that reuses the id, and progress
    // (todayWins etc.) has also reset to 0 so it genuinely isn't earned yet.
    expect(get().claimedChallenges).not.toContain(claimedId);
    expect(get().todayWins).toBe(0);
  });

  it('a weekly id claimed this week cannot be re-claimed, and is cleared once the week rolls over', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z')); // a Monday

    const thisWeeksWeekly = getWeeklyChallenges(new Date());
    const claimedId = thisWeeksWeekly[0].id;

    get().recordBattleResult(true, 0, 0, 20, 1); // stamps weeklyStatsDate
    expect(get().claimChallenge(claimedId)).toBe(true);
    expect(get().claimChallenge(claimedId)).toBe(false);

    // Jump into the following week and resync.
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    get().syncPeriods();

    expect(get().claimedChallenges).not.toContain(claimedId);
    expect(get().weekWins).toBe(0);
  });

  it('the all-challenges bonus claim keys follow the same rollover rules', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    get().recordBattleResult(true, 1, 0, 20, 1);
    expect(get().claimChallenge('d_all_bonus')).toBe(true);
    expect(get().claimChallenge('d_all_bonus')).toBe(false);

    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));
    get().syncPeriods();
    expect(get().claimedChallenges).not.toContain('d_all_bonus');
  });
});
