import { describe, it, expect } from 'vitest';
import { BATTLE_PASS_REWARDS } from '@/components/BattlePass';
import { bestOwnedBorder, ownedEmotes, RENDERABLE_COSMETICS } from './cosmetics';

describe('cosmetic entitlement rendering', () => {
  it('picks the highest-ranked owned border and ignores unknowns', () => {
    expect(bestOwnedBorder([])).toBeNull();
    expect(bestOwnedBorder(['Teddy Emote'])).toBeNull();
    expect(bestOwnedBorder(['Gold Border'])).toBe('gold');
    expect(bestOwnedBorder(['Gold Border', 'Diamond Border'])).toBe('diamond');
    expect(bestOwnedBorder(['Diamond Border'])).toBe('diamond');
    expect(bestOwnedBorder(['Something Else'])).toBeNull();
  });

  it('lists only the emotes the player owns', () => {
    expect(ownedEmotes([])).toEqual([]);
    expect(ownedEmotes(['Confetti Cannon Emote']).map((e) => e.effect)).toEqual(['confetti']);
    expect(ownedEmotes(['Teddy Emote', 'Confetti Cannon Emote'])).toHaveLength(2);
  });

  it("every 'exclusive' the Battle Pass sells is renderable (no paid no-op rewards)", () => {
    // The exact bug this prevents: the pass sold 'Gold Border' etc. as premium
    // tier rewards, unlockCosmetic recorded them — and nothing anywhere
    // rendered them. A renamed or newly added exclusive in the reward table
    // that this module doesn't know about silently regresses to that state.
    //
    // Read the REAL exported table, not a regex over source text: the earlier
    // source-scrape only matched single-quoted names with `type` written
    // immediately before `name`, so a double-quoted name (the convention on
    // half this table's rows), an apostrophe-bearing name, or a field reorder
    // slipped past unseen — and its >=2 canary could not notice ONE missed
    // entry among four matches.
    const sold = BATTLE_PASS_REWARDS
      .flatMap((tier) => [tier.free, tier.premium])
      .filter((reward) => reward?.type === 'exclusive')
      .map((reward) => reward.name);
    expect(sold.length, 'no exclusive rewards found in BATTLE_PASS_REWARDS')
      .toBeGreaterThanOrEqual(2);
    for (const name of sold) {
      expect(
        RENDERABLE_COSMETICS.includes(name),
        `Battle Pass sells exclusive "${name}" but src/lib/cosmetics.js cannot render it — ` +
          `the player would pay for a reward that does nothing. Add it to cosmetics.js.`
      ).toBe(true);
    }
  });
});
