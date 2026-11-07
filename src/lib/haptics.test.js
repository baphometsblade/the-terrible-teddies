import { describe, it, expect } from 'vitest';
import { HAPTIC_PATTERNS, pulse } from './haptics';

describe('haptics', () => {
  it('asks for a short pattern only when the player has them on', () => {
    const seen = [];
    const vibrate = (pattern) => { seen.push(pattern); return true; };
    expect(pulse('fight', false, vibrate)).toBe(false);
    expect(seen).toEqual([]);
    expect(pulse('fight', true, vibrate)).toBe(true);
    expect(seen[0]).toEqual(HAPTIC_PATTERNS.fight);
    expect(pulse('nope', true, vibrate)).toBe(false);
  });

  it('stays quiet when the phone cannot buzz', () => {
    expect(pulse('buy', true, undefined)).toBe(false);
    expect(pulse('buy', true, () => { throw new Error('no'); })).toBe(false);
  });
});
