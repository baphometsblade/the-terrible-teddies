// Rolling quarterly seasons, anchored at Season 1 = April–June 2026 (which
// matches the original hardcoded "Season 1: Teddy Rampage" end date of
// 2026-06-30). Everything is derived from "now", so the countdown can never
// go stale the way the previous fixed SEASON_END did — the shipped Battle
// Pass sat at "0 days left" once that date passed, with no rollover.
const SEASON_EPOCH_YEAR = 2026;
const SEASON_EPOCH_MONTH = 3; // April (0-indexed) — start of Season 1
const SEASON_LENGTH_MONTHS = 3;

export const SEASON_NAMES = [
  'Teddy Rampage',
  'Fluffpocalypse',
  'Stuffing Storm',
  'Hibernation Havoc',
];

/** A season's display name, e.g. "Season 3: Stuffing Storm". */
export const seasonName = (number) => {
  const nameIndex = (((number - 1) % SEASON_NAMES.length) + SEASON_NAMES.length) % SEASON_NAMES.length;
  return `Season ${number}: ${SEASON_NAMES[nameIndex]}`;
};

/**
 * Season `number` (1-based): its name, store key and UTC bounds. endDate is
 * exclusive — the first instant of the next season.
 */
export function getSeason(number) {
  const startDate = new Date(Date.UTC(SEASON_EPOCH_YEAR, SEASON_EPOCH_MONTH + (number - 1) * SEASON_LENGTH_MONTHS, 1));
  const endDate = new Date(Date.UTC(SEASON_EPOCH_YEAR, SEASON_EPOCH_MONTH + number * SEASON_LENGTH_MONTHS, 1));
  return { number, name: seasonName(number), key: `season-${number}`, startDate, endDate };
}

/** The season a store key ('season-3') names, or null for anything else. */
export const seasonFromKey = (key) => {
  const number = Number(/^season-(\d+)$/.exec(key ?? '')?.[1]);
  return number >= 1 ? getSeason(number) : null;
};

/**
 * The season active at `now` (default: current time), computed in UTC.
 * endDate is exclusive — the first instant of the next season.
 */
export function getCurrentSeason(now = new Date()) {
  const monthsSinceEpoch =
    (now.getUTCFullYear() - SEASON_EPOCH_YEAR) * 12 +
    now.getUTCMonth() - SEASON_EPOCH_MONTH;
  const number = Math.floor(monthsSinceEpoch / SEASON_LENGTH_MONTHS) + 1;
  const season = getSeason(number);
  const daysLeft = Math.max(0, Math.ceil((season.endDate.getTime() - now.getTime()) / 86_400_000));
  return { ...season, daysLeft };
}

export const getSeasonDaysLeft = () => getCurrentSeason().daysLeft;

// How many days before its end a season counts as ending: the pass then says
// how many rewards are still unclaimed and when the season stops.
export const SEASON_ENDING_DAYS = 7;

/**
 * When a season ends, in the player's own clock: "Dec 31, 4:00 PM" in Los
 * Angeles for a season that ends at midnight UTC. With the time, because a
 * date alone was a day out for half the world (the boundary is UTC midnight).
 * `options` reach toLocaleString (tests pin a time zone and locale).
 */
export const formatSeasonEnd = (endDate, { locale, ...options } = {}) => endDate.toLocaleString(locale, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...options,
});
