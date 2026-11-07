// A weekly round for someone who went quiet and came back under-levelled.
// One a week, coins and one ordinary pack, and only while the level is
// behind the days they have had.

import { calendarGap } from './loginStreak';

export const CATCH_UP_AFTER_DAYS = 7;
export const CATCH_UP_COIN_CAP = 400;

export const catchUpFor = ({ firstSeenDate = null, level = 1, catchUpWeek = null } = {}, now = new Date(), weekKey = '') => {
  if (!firstSeenDate || (weekKey && catchUpWeek === weekKey)) return null;
  const days = calendarGap(firstSeenDate, now);
  if (days == null || days < CATCH_UP_AFTER_DAYS) return null;
  const expected = Math.floor(days / 3);
  if ((Number(level) || 1) >= expected) return null;
  return {
    days,
    coins: Math.min(CATCH_UP_COIN_CAP, days * 15),
    packs: 1,
    line: 'You went quiet. The rumour did not. One round, this week, to catch up.',
  };
};
