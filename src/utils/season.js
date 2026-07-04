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

/**
 * The season active at `now` (default: current time), computed in UTC.
 * endDate is exclusive — the first instant of the next season.
 */
export function getCurrentSeason(now = new Date()) {
  const monthsSinceEpoch =
    (now.getUTCFullYear() - SEASON_EPOCH_YEAR) * 12 +
    now.getUTCMonth() - SEASON_EPOCH_MONTH;
  const index = Math.floor(monthsSinceEpoch / SEASON_LENGTH_MONTHS);
  const number = index + 1;
  const endDate = new Date(Date.UTC(
    SEASON_EPOCH_YEAR,
    SEASON_EPOCH_MONTH + (index + 1) * SEASON_LENGTH_MONTHS,
    1
  ));
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000));
  const nameIndex = (((number - 1) % SEASON_NAMES.length) + SEASON_NAMES.length) % SEASON_NAMES.length;
  const name = `Season ${number}: ${SEASON_NAMES[nameIndex]}`;
  return { number, name, key: `season-${number}`, endDate, daysLeft };
}

export const getSeasonDaysLeft = () => getCurrentSeason().daysLeft;
