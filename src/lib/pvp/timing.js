// Shared clocks. The server is the one that ends a turn; the client only
// displays the deadline the server stored. Async on purpose: a live brawl
// is a stool you can step away from, not a reflex test.

export const TURN_MS = 90_000;
export const MULLIGAN_MS = 45_000;
export const GHOST_OFFER_MS = 20_000;
export const RECONNECT_GRACE_MS = 45_000;
export const HEARTBEAT_STALE_MS = 20_000;
export const ABANDON_PENALTY = 10;
export const POLL_MS = 750;
// With the Realtime socket subscribed, pushes carry the match and the poll is
// only a safety net, so a seat syncs at most this often instead of every
// POLL_MS. Keeps a full bar from spending an edge call per player per 750 ms.
export const LIVE_POLL_MS = 5_000;

// Matchmaking window. Starts at ±50 and widens by 50 every 5s, capped at 400.
export const WINDOW_BASE = 50;
export const WINDOW_STEP = 50;
export const WINDOW_EVERY_MS = 5_000;
export const WINDOW_CAP = 400;

export const ratingWindow = (waitMs) => {
  const wait = Math.max(0, Number(waitMs) || 0);
  const steps = Math.floor(wait / WINDOW_EVERY_MS);
  return Math.min(WINDOW_CAP, WINDOW_BASE + WINDOW_STEP * steps);
};

/** True when two ratings can be paired given how long the longer wait has been. */
export const ratingsMatch = (a, b, waitMs) =>
  Math.abs((Number(a) || 0) - (Number(b) || 0)) <= ratingWindow(waitMs);
