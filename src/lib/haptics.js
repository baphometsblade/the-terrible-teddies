// Short buzzes for a sit-down, a purchase, and putting a look on.
// iOS Safari has no vibration API; pulse returns false and changes nothing.

export const HAPTIC_PATTERNS = Object.freeze({
  fight: [12, 30, 18],
  buy: [16, 40, 16],
  tap: [10],
});

/**
 * Buzz `kind` when haptics are on and the device can. Returns whether a
 * vibration was requested.
 */
export const pulse = (kind, enabled, vibrate = globalThis.navigator?.vibrate?.bind(globalThis.navigator)) => {
  const pattern = HAPTIC_PATTERNS[kind];
  if (!enabled || !pattern || typeof vibrate !== 'function') return false;
  try {
    return vibrate(pattern) !== false;
  } catch {
    return false;
  }
};
