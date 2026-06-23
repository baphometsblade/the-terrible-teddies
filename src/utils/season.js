// Single source of truth for the current season's end date, so every surface
// (Battle Pass, Leaderboard, etc.) shows the same countdown instead of drifting
// hardcoded numbers that contradict each other.
export const SEASON_NAME = "Season 1: Teddy Rampage";
export const SEASON_END = new Date('2026-06-30T23:59:59Z');

export const getSeasonDaysLeft = () =>
  Math.max(0, Math.ceil((SEASON_END.getTime() - Date.now()) / 86_400_000));
