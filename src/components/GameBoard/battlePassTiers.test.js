import { describe, it, expect } from 'vitest';
import { BATTLE_PASS_REWARDS } from '@/components/BattlePass';
import { BATTLE_PASS_TIER_XP, battlePassTier } from './battlePassTiers';

describe('battlePassTiers', () => {
  // Derived from the live reward table, not restated, so retuning the pass
  // fails here until the board's copy is retuned with it.
  it('matches the Battle Pass reward table tier for tier', () => {
    expect(BATTLE_PASS_TIER_XP).toEqual(
      [...BATTLE_PASS_REWARDS].sort((a, b) => a.tier - b.tier).map((r) => r.xpRequired),
    );
    expect(BATTLE_PASS_REWARDS.map((r) => r.tier)).toEqual(BATTLE_PASS_TIER_XP.map((_, i) => i + 1));
  });

  // The same reduce the Battle Pass dialog uses for its "current tier".
  const dialogTier = (xp) => BATTLE_PASS_REWARDS.reduce((t, r) => (xp >= r.xpRequired ? r.tier : t), 0);

  it('agrees with the dialog on every threshold and either side of it', () => {
    for (const r of BATTLE_PASS_REWARDS) {
      for (const xp of [r.xpRequired - 1, r.xpRequired, r.xpRequired + 1]) {
        if (xp < 0) continue;
        expect(battlePassTier(xp), `season XP ${xp}`).toBe(dialogTier(xp));
      }
    }
    expect(battlePassTier(1e9)).toBe(BATTLE_PASS_REWARDS.length);
  });
});
