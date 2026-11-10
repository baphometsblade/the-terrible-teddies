// One reroll a day and one a week. The rotating board stays the date-seeded
// pick from challenges.js; a reroll swaps one showing quest for one that is
// not, and the swap is ignored once its day or week key no longer matches.
// Nothing here writes the store. The replacement is hashed from the period
// and the quest, so two devices rerolling the same quest land on the same one.

import {
  DAILY_POOL, WEEKLY_POOL, getDailyChallenges, getWeeklyChallenges, challengeProgress, weekKeyOf,
} from '../stores/challenges';

export { weekKeyOf, DAILY_POOL, WEEKLY_POOL };

export const emptyRerolls = () => ({
  dailyKey: null,
  weeklyKey: null,
  dailyUsed: 0,
  weeklyUsed: 0,
  dailySwap: null,
  weeklySwap: null,
});

const asSwap = (raw) => (
  raw && typeof raw.from === 'string' && typeof raw.to === 'string' && raw.from !== raw.to
    ? { from: raw.from, to: raw.to }
    : null
);

/** A saved reroll record with a shape the board can read. */
export const normalizeRerolls = (raw) => {
  const blank = emptyRerolls();
  if (!raw || typeof raw !== 'object') return blank;
  return {
    dailyKey: typeof raw.dailyKey === 'string' ? raw.dailyKey : null,
    weeklyKey: typeof raw.weeklyKey === 'string' ? raw.weeklyKey : null,
    dailyUsed: raw.dailyUsed === 1 ? 1 : 0,
    weeklyUsed: raw.weeklyUsed === 1 ? 1 : 0,
    dailySwap: asSwap(raw.dailySwap),
    weeklySwap: asSwap(raw.weeklySwap),
  };
};

/** The showing list with one swap applied, or the list unchanged when the swap does not fit. */
export const applySwap = (picked, pool, swap) => {
  if (!swap) return picked.slice();
  const next = pool.find((challenge) => challenge.id === swap.to);
  if (!next) return picked.slice();
  if (!picked.some((challenge) => challenge.id === swap.from)) return picked.slice();
  if (picked.some((challenge) => challenge.id === next.id)) return picked.slice();
  return picked.map((challenge) => (challenge.id === swap.from ? next : challenge));
};

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A quest from the pool that is not showing, stable for this seed and quest. */
export const replacementFor = (pool, shown, fromId, seed) => {
  const shownIds = new Set(shown.map((challenge) => challenge.id));
  const options = pool.filter((challenge) => !shownIds.has(challenge.id));
  if (!options.length) return null;
  const index = hashString(`${seed}|${fromId}`) % options.length;
  return { from: fromId, to: options[index].id };
};

/**
 * Today's and this week's boards, with a reroll whose key still matches
 * applied, and how many rerolls are left. A record from another day is
 * ignored here rather than wiped, so opening the panel writes nothing.
 */
export const visibleChallenges = (state = {}, date = new Date()) => {
  const rerolls = normalizeRerolls(state.questRerolls);
  const dailyKey = date.toDateString();
  const weeklyKey = weekKeyOf(date);
  const dailySwap = rerolls.dailyKey === dailyKey ? rerolls.dailySwap : null;
  const weeklySwap = rerolls.weeklyKey === weeklyKey ? rerolls.weeklySwap : null;
  return {
    daily: applySwap(getDailyChallenges(date), DAILY_POOL, dailySwap),
    weekly: applySwap(getWeeklyChallenges(date), WEEKLY_POOL, weeklySwap),
    dailyLeft: rerolls.dailyKey === dailyKey ? 1 - rerolls.dailyUsed : 1,
    weeklyLeft: rerolls.weeklyKey === weeklyKey ? 1 - rerolls.weeklyUsed : 1,
  };
};

/**
 * The next reroll record after swapping `fromId`, or null when the reroll is
 * refused: none left, not showing, already claimed, or already finished.
 * Finished quests stay: a reroll is for one you do not want to do, not a way
 * to throw away a reward.
 */
export const rerollPatch = (state = {}, period, fromId, date = new Date()) => {
  const weekly = period === 'weekly';
  if (period !== 'daily' && !weekly) return null;
  const view = visibleChallenges(state, date);
  const shown = weekly ? view.weekly : view.daily;
  const left = weekly ? view.weeklyLeft : view.dailyLeft;
  if (left < 1) return null;
  const target = shown.find((challenge) => challenge.id === fromId);
  if (!target) return null;
  const claimed = Array.isArray(state.claimedChallenges) ? state.claimedChallenges : [];
  if (claimed.includes(fromId)) return null;
  if (challengeProgress(target, state) >= target.target) return null;
  const pool = weekly ? WEEKLY_POOL : DAILY_POOL;
  const key = weekly ? weekKeyOf(date) : date.toDateString();
  const swap = replacementFor(pool, shown, fromId, `${weekly ? 'w' : 'd'}|${key}`);
  if (!swap) return null;
  const prev = normalizeRerolls(state.questRerolls);
  if (weekly) return { ...prev, weeklyKey: key, weeklyUsed: 1, weeklySwap: swap };
  return { ...prev, dailyKey: key, dailyUsed: 1, dailySwap: swap };
};
