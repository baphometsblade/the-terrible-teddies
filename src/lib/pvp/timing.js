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
// The queue. A waiting stool used to ask every POLL_MS (80 edge calls a
// minute, more when a call outlasted the tick). The match itself arrives on
// the Realtime socket the moment it is dealt, so the poll only has to drive
// the matchmaker as rating windows widen (every WINDOW_EVERY_MS) and to show
// the ghost offer: once a window's worth while the socket is up, and every
// QUEUE_POLL_MS when it is down and the poll is the only way to hear of a
// match. pvp-timeout's minute also pairs, as a net under both.
export const QUEUE_LIVE_POLL_MS = 5_000;
export const QUEUE_POLL_MS = 3_000;

/**
 * How long the brawl screen waits before its next look at the server, or
 * null to wait for the tab to come back. A hidden tab asks nothing: Realtime
 * keeps delivering, the heartbeat keeps the seat warm, and the screen looks
 * again the moment it is shown.
 */
export function pollDelay({ inMatch = false, queued = false, live = false, hidden = false } = {}) {
  if (hidden) return null;
  if (inMatch) return live ? LIVE_POLL_MS : POLL_MS;
  if (queued) return live ? QUEUE_LIVE_POLL_MS : QUEUE_POLL_MS;
  return POLL_MS;
}

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
