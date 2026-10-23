import { describe, it, expect } from 'vitest';
import { getTimeUntilReset, nextReset } from './resetTimer';

// Local dates throughout, as the store stamps its days: the reset is the
// player's own midnight, and the start of their Monday. Mid-June, so no clock
// change falls inside a counted span in any time zone the suite runs in.
describe('getTimeUntilReset', () => {
  it('counts down to local midnight for the daily reset', () => {
    expect(getTimeUntilReset(false, new Date(2026, 5, 17, 11, 33, 0))).toBe('12h 27m');
    expect(getTimeUntilReset(false, new Date(2026, 5, 17, 23, 59, 0))).toBe('0h 1m');
    expect(getTimeUntilReset(false, new Date(2026, 5, 17, 0, 0, 0))).toBe('24h 0m');
  });

  it('counts down to the start of next Monday for the weekly reset', () => {
    // 2026-06-19 is a Friday: Monday the 22nd is 2 days and 12 hours away at noon.
    expect(getTimeUntilReset(true, new Date(2026, 5, 19, 12, 0, 0))).toBe('2d 12h');
    // From a Sunday evening it is hours away; from a Monday, a full week.
    expect(getTimeUntilReset(true, new Date(2026, 5, 21, 20, 0, 0))).toBe('0d 4h');
    expect(getTimeUntilReset(true, new Date(2026, 5, 22, 0, 0, 0))).toBe('7d 0h');
  });

  it('agrees with the day stamp the store uses', () => {
    // The reset lands exactly where toDateString() changes, so "Next reward
    // in …" reaches zero at the moment a new daily claim becomes possible.
    const now = new Date(2026, 5, 17, 18, 5, 0);
    const reset = nextReset(false, now);
    expect(new Date(reset - 1).toDateString()).toBe(now.toDateString());
    expect(reset.toDateString()).not.toBe(now.toDateString());
  });
});
