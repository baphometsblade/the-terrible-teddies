import { describe, expect, it } from 'vitest';
import { hitAside, hitFlavor } from './critTalk';

const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait|ageplay|incest|daddy|mommy|non-?consent|bestiality)\b/i;

describe('hit talk', () => {
  it('puts a short word on a kill, a trample and a heavy hit, and nothing on a tap', () => {
    expect(hitFlavor({ dmg: 2 })).toBe('');
    expect(hitFlavor({ dmg: 1, killed: true })).toBe('spent');
    expect(hitFlavor({ dmg: 6 })).toBe('deep');
    expect(hitFlavor({ dmg: 4, overkill: 2 })).toBe('extra');
    for (const word of ['spent', 'deep', 'extra']) expect(word.length).toBeLessThanOrEqual(8);
  });

  it('says the wink in one house line, and stays quiet on an ordinary tap', () => {
    expect(hitAside({ dmg: 2, target: 'Sally' })).toBe('');
    const lines = [
      hitAside({ attacker: 'Quinn', target: 'Sally', killed: true }),
      hitAside({ attacker: 'Quinn', target: 'Sally', dmg: 6 }),
      hitAside({ overkill: 2, foe: 'Chuck' }),
      hitAside({ face: true, dmg: 5, foe: 'Chuck' }),
    ];
    expect(lines.every(Boolean)).toBe(true);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
      expect(line).not.toMatch(/!/);
      expect(line).not.toMatch(BANNED);
    }
    expect(lines[1]).toMatch(/walking funny/);
    expect(lines[3]).toMatch(/mouth/);
  });
});
