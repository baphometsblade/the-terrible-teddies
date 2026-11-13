import { describe, expect, it } from 'vitest';
import {
  LIVE_POLL_MS, POLL_MS, QUEUE_LIVE_POLL_MS, QUEUE_POLL_MS, WINDOW_EVERY_MS, pollDelay,
} from './timing.js';

describe('pollDelay', () => {
  it('asks nothing from a hidden tab, queued or seated', () => {
    expect(pollDelay({ queued: true, hidden: true })).toBeNull();
    expect(pollDelay({ inMatch: true, live: true, hidden: true })).toBeNull();
  });

  it('polls the queue slowly with the socket up, faster without it, and never at the old 750 ms', () => {
    expect(pollDelay({ queued: true, live: true })).toBe(QUEUE_LIVE_POLL_MS);
    expect(pollDelay({ queued: true, live: false })).toBe(QUEUE_POLL_MS);
    expect(QUEUE_POLL_MS).toBeGreaterThanOrEqual(3_000);
    expect(QUEUE_LIVE_POLL_MS).toBeGreaterThanOrEqual(QUEUE_POLL_MS);
  });

  it('still drives the matchmaker once per rating-window step while the socket carries the match', () => {
    expect(QUEUE_LIVE_POLL_MS).toBeLessThanOrEqual(WINDOW_EVERY_MS);
  });

  it('keeps the in-match schedule: a safety-net sync with the socket, the fast poll without', () => {
    expect(pollDelay({ inMatch: true, live: true })).toBe(LIVE_POLL_MS);
    expect(pollDelay({ inMatch: true, live: false })).toBe(POLL_MS);
  });

  it('a seat in a match is not also a queued seat', () => {
    expect(pollDelay({ inMatch: true, queued: true, live: true })).toBe(LIVE_POLL_MS);
  });

  it('cuts a waiting stool from 80 calls a minute to at most 20, and 12 with the socket', () => {
    const perMinute = (ms) => 60_000 / ms;
    expect(perMinute(POLL_MS)).toBe(80);
    expect(perMinute(pollDelay({ queued: true }))).toBeLessThanOrEqual(20);
    expect(perMinute(pollDelay({ queued: true, live: true }))).toBeLessThanOrEqual(12);
  });
});
