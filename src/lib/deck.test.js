import { describe, it, expect } from 'vitest';
import { deckKey, sameDeck } from './deck';

describe('deck identity', () => {
  it('ignores order: the battle shuffles anyway', () => {
    expect(sameDeck([1, 2, 3], [3, 1, 2])).toBe(true);
  });

  it('counts copies', () => {
    expect(sameDeck([1, 1, 2], [1, 2, 2])).toBe(false);
    expect(sameDeck([1, 1, 2], [1, 2])).toBe(false);
  });

  it('sorts numerically, so 10 and 2 do not swap places as strings would', () => {
    expect(deckKey([10, 2, 1])).toBe('1,2,10');
  });

  it('treats a missing deck as empty and never mutates its input', () => {
    expect(deckKey(undefined)).toBe('');
    const ids = [3, 1, 2];
    deckKey(ids);
    expect(ids).toEqual([3, 1, 2]);
  });
});
