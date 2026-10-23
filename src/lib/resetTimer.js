// How long until the daily or weekly reset, as the screens print it. Shared by
// Challenges (its daily and weekly reset lines) and Daily Rewards (when the
// next reward can be claimed), which all turn over at the same moments.
//
// Local time, on purpose: the store's daily stamps (lastLoginDate,
// dailyStatsDate) are Date#toDateString(), so a day ends at the player's own
// midnight, and the weekly stats reset at the start of a local Monday.

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** The next reset after `now`: local midnight, or the start of next Monday. */
export const nextReset = (isWeekly = false, now = new Date()) => {
  const reset = new Date(now);
  // Monday is day 1; from a Monday the next one is a full week away.
  const days = isWeekly ? ((8 - now.getDay()) % 7 || 7) : 1;
  reset.setDate(now.getDate() + days);
  reset.setHours(0, 0, 0, 0);
  return reset;
};

/** "12h 27m" until the daily reset, or "3d 4h" until the weekly one. */
export const getTimeUntilReset = (isWeekly = false, now = new Date()) => {
  const diff = nextReset(isWeekly, now) - now;
  const hours = Math.floor(diff / HOUR);
  const minutes = Math.floor((diff % HOUR) / MINUTE);
  return isWeekly
    ? `${Math.floor(hours / 24)}d ${hours % 24}h`
    : `${hours}h ${minutes}m`;
};
