import { describe, it, expect } from 'vitest';
import {
  PACK_REVEAL_NEW, PACK_REVEAL_DUPES, PACK_REVEAL_MAX_CHARS,
  pickIndex, pickRevealLines, freshLine, dupesLine,
} from './packLines';

describe('pack reveal lines', () => {
  it('every line fits its slot with the largest numbers the slot can show', () => {
    // 10 new cards at most; duplicate coins stay in the low thousands.
    PACK_REVEAL_NEW.forEach((_, i) => expect(freshLine(i, 10).length).toBeLessThanOrEqual(PACK_REVEAL_MAX_CHARS));
    PACK_REVEAL_DUPES.forEach((_, i) => expect(dupesLine(i, 1500).length).toBeLessThanOrEqual(PACK_REVEAL_MAX_CHARS));
  });

  it('leaves no placeholder behind and names no card', () => {
    PACK_REVEAL_NEW.forEach((_, i) => expect(freshLine(i, 3)).not.toMatch(/[{}]/));
    PACK_REVEAL_DUPES.forEach((_, i) => expect(dupesLine(i, 40)).not.toMatch(/[{}]/));
    // The fixed fallback is line 1 of each pool.
    expect(freshLine(0, 4)).toBe('4 new. Don’t make a scene.');
    expect(dupesLine(0, 40)).toBe('+40 coins. Repeat customers.');
  });

  it('never repeats the previous pick when it has a choice', () => {
    for (let last = 0; last < PACK_REVEAL_NEW.length; last++) {
      for (const r of [0, 0.3, 0.99]) {
        expect(pickIndex(PACK_REVEAL_NEW, last, () => r)).not.toBe(last);
      }
    }
    const { fresh, dupes } = pickRevealLines({ fresh: 2, dupes: 1 }, () => 0.2857);
    expect(fresh).toBeLessThan(PACK_REVEAL_NEW.length);
    expect(dupes).toBeLessThan(PACK_REVEAL_DUPES.length);
  });
});
