import { describe, it, expect } from 'vitest';
import { BOOT_HINT_SLOW, BOOT_HINT_STUCK } from './BootScreen';

// The two things the wait says (6 s, then 20 s when Reload arrives). e2e finds
// the hint, and the cloud-save and password-reset specs poll for it, by its
// first sentence, so that sentence is pinned; the rest is the bouncer's.
describe('the boot hints', () => {
  it('both open with the plain fact, word for word', () => {
    expect(BOOT_HINT_SLOW.startsWith('Still trying to reach the server. ')).toBe(true);
    expect(BOOT_HINT_STUCK.startsWith('Still trying to reach the server. ')).toBe(true);
  });

  it('fit the band: 110 characters, so Reload still fits the fixed 9rem panel', () => {
    for (const hint of [BOOT_HINT_SLOW, BOOT_HINT_STUCK]) expect(hint.length, hint).toBeLessThanOrEqual(110);
  });

  it('say what to do (the stuck one adds reload), and keep the pre-door rule: no profanity or sex', () => {
    expect(BOOT_HINT_SLOW).toMatch(/Check your connection/);
    expect(BOOT_HINT_STUCK).toMatch(/reload/i);
    for (const hint of [BOOT_HINT_SLOW, BOOT_HINT_STUCK]) expect(hint).not.toMatch(/fuck|shit|ass\b|sex|naked|thong/i);
  });
});
