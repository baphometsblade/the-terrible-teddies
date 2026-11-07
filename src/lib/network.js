// What a failed request means for the player. Pure: no React, no supabase.
// The banner and the shops both ask it, so a "Failed to fetch" from the
// browser and a sentence the server wrote do not get the same treatment.

// Browser fetch failures. AbortError is a timeout we already explain, and a
// TypeError from our own code ("x is not a function") is not a dead radio.
const TRANSPORT_MESSAGE = /failed to fetch|networkerror|load failed|network request failed|internet disconnected|the network connection was lost/i;

/**
 * True when the request never got an answer worth showing.
 * @param {unknown} error
 */
export function isTransportFailure(error) {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  if (name === 'AbortError') return false;
  if (name === 'AuthRetryableFetchError') return true;
  return TRANSPORT_MESSAGE.test(message);
}

/**
 * The sentence to show. A transport failure becomes one plain line (the
 * House does not joke in errors). Anything the server already explained
 * is kept as it wrote it.
 * @param {unknown} error
 * @param {string} fallback
 */
export function playerFacingError(error, fallback) {
  if (isTransportFailure(error)) return 'Couldn’t reach the server. Nothing was changed.';
  const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message.trim()
    : '';
  return message || fallback;
}

/** True unless the browser has said the device is offline. */
export function readOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export const OFFLINE_NOTICE = Object.freeze({
  text: 'You’re offline. Progress stays on this device.',
  lingerMs: 0,
});

export const ONLINE_NOTICE = Object.freeze({
  text: 'Back online.',
  lingerMs: 4000,
});

/**
 * The notice for a connectivity change. Boot announces offline only — a
 * page that loaded online does not need "Back online." `lingerMs` 0 stays
 * until the connection returns.
 * @param {boolean} previousOnline
 * @param {boolean} nextOnline
 * @param {{ boot?: boolean }} [options]
 */
export function noticeForTransition(previousOnline, nextOnline, { boot = false } = {}) {
  if (boot) return nextOnline ? null : OFFLINE_NOTICE;
  if (previousOnline === nextOnline) return null;
  return nextOnline ? ONLINE_NOTICE : OFFLINE_NOTICE;
}
