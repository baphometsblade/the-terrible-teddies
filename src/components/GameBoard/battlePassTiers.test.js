import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BATTLE_PASS_REWARDS } from '@/lib/battlePass';
import { battlePassTier } from './battlePassTiers';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

afterEach(() => {
  vi.doUnmock('@/lib/battlePass');
  vi.resetModules();
});

describe('battlePassTiers', () => {
  // This used to be a hand-copied column of the reward table's thresholds,
  // with a test to catch the copy drifting. The copy is gone; these pin that
  // the result panel's tier line reads the table itself.
  it('opens each tier at the reward table’s own threshold', () => {
    for (const r of BATTLE_PASS_REWARDS) {
      expect(battlePassTier(r.xpRequired), `tier ${r.tier} at ${r.xpRequired} XP`).toBe(r.tier);
      if (r.xpRequired > 0) expect(battlePassTier(r.xpRequired - 1), `just short of tier ${r.tier}`).toBe(r.tier - 1);
    }
    expect(battlePassTier(1e9)).toBe(BATTLE_PASS_REWARDS.length);
  });

  it('follows the table when it is retuned, so it cannot be a copy', async () => {
    // A different table in the data module's place: a copy would still
    // answer from the old thresholds.
    vi.resetModules();
    vi.doMock('@/lib/battlePass', async (importOriginal) => {
      const real = await importOriginal();
      const retuned = [{ tier: 1, xpRequired: 0 }, { tier: 2, xpRequired: 7 }];
      return { ...real, BATTLE_PASS_REWARDS: retuned, currentTier: (xp) => real.currentTier(xp, retuned) };
    });
    const { battlePassTier: retunedTier } = await import('./battlePassTiers');
    expect(retunedTier(6)).toBe(1);
    expect(retunedTier(7)).toBe(2);
    expect(retunedTier(100)).toBe(2);
  });

  it('is what the result panel names its tier line with, and holds no thresholds of its own', () => {
    const board = read('src/components/GameBoard/GameBoard.jsx');
    expect(board).toMatch(/import \{ battlePassTier \} from '\.\/battlePassTiers'/);
    expect(board).toMatch(/tierAfter: progress \? battlePassTier\(progress\.seasonXPAfter\)/);
    const src = read('src/components/GameBoard/battlePassTiers.js').replace(/^\s*\/\/.*$/gm, '');
    expect(src).toMatch(/from '@\/lib\/battlePass'/);
    expect(src, 'battlePassTiers.js holds numbers again: read the reward table instead').not.toMatch(/\d{3,}/);
  });
});
