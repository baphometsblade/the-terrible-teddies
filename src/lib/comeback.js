// A tab the bar keeps when someone disappears. Claimed with the daily reward
// on the night they walk back in, so it cannot be collected twice for one
// absence: the claim stamps today, and the next one sees a gap of one.
//
// The first night, and a single missed night (the streak shield's job), pay
// nothing here. The payout grows with the nights away and stops growing.

export const COMEBACK_AFTER_DAYS = 3;
export const COMEBACK_CAP_DAYS = 14;
const COINS_PER_NIGHT = 40;

/**
 * The welcome-back grant for a gap of `gap` local midnights, or null when
 * the absence is too short to be one. `days` is what is paid for, never more
 * than the cap; `capped` says the real absence was longer.
 */
export const comebackFor = (gap) => {
  if (typeof gap !== 'number' || !Number.isFinite(gap) || gap < COMEBACK_AFTER_DAYS) return null;
  const days = Math.min(COMEBACK_CAP_DAYS, Math.floor(gap));
  return {
    days,
    capped: gap > COMEBACK_CAP_DAYS,
    coins: days * COINS_PER_NIGHT,
    packs: days >= COMEBACK_CAP_DAYS ? 2 : days >= 7 ? 1 : 0,
  };
};
