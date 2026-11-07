// The login streak: which day a claim pays, when one missed night is forgiven,
// and the coin bonus a long bender adds on top of the seven-day table.
//
// Pure. checkDailyLogin pays from this, and Daily Rewards reads the same
// answer before the tap, so the tile marked Today and the grant cannot
// disagree. A gap is counted in local midnights: Date#toDateString() is what
// the save stores, and a DST shift is 23 or 25 hours, which rounding absorbs.

export const STREAK_CYCLE = 7;
export const SHIELD_CAP = 1;
// Each finished week past the first adds this much of the day's coins, and
// the fourth extra week is the ceiling (100%). Week 1 pays the table as-is.
export const WEEK_BONUS_STEP = 25;
export const WEEK_BONUS_CAP_STEPS = 4;

/**
 * Whole local midnights between a stored `toDateString()` and `now`.
 * Null when there is no previous claim. Negative when the clock went backwards.
 */
export const calendarGap = (lastLoginDate, now) => {
  if (!lastLoginDate) return null;
  const from = new Date(lastLoginDate);
  if (Number.isNaN(from.getTime())) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

/** Extra coins a streak this long adds to one day's base coins. Never negative. */
export const weekCoinBonus = (baseCoins, streak) => {
  const base = Math.max(0, Math.floor(Number(baseCoins) || 0));
  const weeksBeyond = Math.floor((Math.max(1, Math.floor(Number(streak) || 1)) - 1) / STREAK_CYCLE);
  const pct = Math.min(WEEK_BONUS_CAP_STEPS, weeksBeyond) * WEEK_BONUS_STEP;
  return Math.floor((base * pct) / 100);
};

/** The week number a streak is in, starting at 1. */
export const streakWeek = (streak) =>
  Math.floor((Math.max(1, Math.floor(Number(streak) || 1)) - 1) / STREAK_CYCLE) + 1;

/**
 * What a claim at `now` does to the streak.
 *
 * Gap 1 (claimed yesterday): the streak continues.
 * Gap 2 (exactly one missed night) with a banked shield: the streak continues
 * and the shield is spent. A wider gap is not covered, and the shield is kept
 * for a later one-night miss.
 * Anything else: day 1 of a new streak.
 * Finishing a multiple of the cycle banks a shield, including the claim that
 * just spent one to get there. A shield never stacks past one.
 */
export const resolveLogin = (state = {}, now = new Date(), cycle = STREAK_CYCLE) => {
  const had = Math.max(0, Math.min(SHIELD_CAP, Math.floor(Number(state.streakShields) || 0)));
  const previous = Math.max(0, Math.floor(Number(state.consecutiveLogins) || 0));
  const gap = calendarGap(state.lastLoginDate ?? null, now);
  const length = cycle > 0 ? cycle : STREAK_CYCLE;

  let streak = 1;
  let usedShield = false;
  let shields = had;
  let broken = false;

  if (gap === null) {
    streak = 1;
  } else if (gap <= 0) {
    streak = Math.max(previous, 1);
  } else if (gap === 1) {
    streak = previous + 1;
  } else if (gap === 2 && had > 0) {
    streak = previous + 1;
    usedShield = true;
    shields = had - 1;
  } else {
    streak = 1;
    broken = true;
  }

  const shieldRefilled = gap === null || gap > 0 ? streak % length === 0 : false;
  if (shieldRefilled) shields = SHIELD_CAP;

  return {
    day: ((streak - 1) % length) + 1,
    streak,
    gap,
    shields,
    usedShield,
    broken,
    alreadyClaimed: gap === 0,
    shieldRefilled,
  };
};
