import { describe, expect, it } from 'vitest';
import { collectiblePool, fieldingProblem, isCardAvailable } from './collectiblePool.js';

const evergreen = { id: 4, filed: 4 };
const seasonal = { id: 'xm-1', filed: 181 };
const season = {
  card_ids: ['xm-1'],
  starts_at: '2026-12-01T00:00:00Z',
  ends_at: '2027-01-01T00:00:00Z',
};
const during = new Date('2026-12-15T00:00:00Z');
const after = new Date('2027-02-01T00:00:00Z');

describe('collectible pool', () => {
  it('fields an owned evergreen card and refuses one they do not own', () => {
    expect(isCardAvailable(evergreen, { owned: [4], seasons: [] })).toBe(true);
    expect(isCardAvailable(evergreen, { owned: [], seasons: [] })).toBe(false);
  });

  it('fields a seasonal card only inside its window, and only if owned', () => {
    const owned = ['xm-1'];
    expect(isCardAvailable(seasonal, { owned, seasons: [season], now: during })).toBe(true);
    expect(isCardAvailable(seasonal, { owned, seasons: [season], now: after })).toBe(false);
    expect(isCardAvailable(seasonal, { owned: [], seasons: [season], now: during })).toBe(false);
  });

  it('lets a ghost face an evergreen card the local player does not own', () => {
    const pool = collectiblePool([evergreen, seasonal], {
      owned: [], seasons: [season], now: after, requireOwned: false,
    });
    expect(pool.map((card) => card.id)).toEqual([4]);
  });

  it('names a deck that fields a closed card', () => {
    expect(fieldingProblem([evergreen, seasonal], {
      owned: [4, 'xm-1'], seasons: [season], now: after,
    })).toBe('That deck has a card you cannot field.');
    expect(fieldingProblem([evergreen], { owned: [4], seasons: [] })).toBeNull();
  });
});
