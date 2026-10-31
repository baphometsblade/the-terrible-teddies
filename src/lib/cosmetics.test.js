import { describe, it, expect } from 'vitest';
import { BATTLE_PASS_REWARDS } from '@/lib/battlePass';
import {
  bestOwnedBorder, ownedEmotes, RENDERABLE_COSMETICS, COSMETIC_FRAMES, frameFor,
  COSMETIC_LABELS, COSMETIC_LABEL_MAX, cosmeticLabel, cosmeticLong,
} from './cosmetics';

describe('cosmetic entitlement rendering', () => {
  it('picks the highest-ranked owned border and ignores unknowns', () => {
    expect(bestOwnedBorder([])).toBeNull();
    expect(bestOwnedBorder(['Teddy Emote'])).toBeNull();
    expect(bestOwnedBorder(['Gold Border'])).toBe('gold');
    expect(bestOwnedBorder(['Gold Border', 'Diamond Border'])).toBe('diamond');
    expect(bestOwnedBorder(['Diamond Border'])).toBe('diamond');
    expect(bestOwnedBorder(['Something Else'])).toBeNull();
  });

  // The card frame and the Battle Pass tile that sells a border both draw
  // from COSMETIC_FRAMES, so every border must have one.
  it('has a frame to draw for every border it ranks', () => {
    const borders = RENDERABLE_COSMETICS.filter((name) => bestOwnedBorder([name]));
    expect(borders.length).toBeGreaterThan(0);
    for (const name of borders) {
      expect(frameFor(name), name).toMatchObject({ metal: expect.stringContaining('gradient'), glow: expect.any(String) });
      expect(COSMETIC_FRAMES[bestOwnedBorder([name])]).toBe(frameFor(name));
    }
    expect(frameFor('Teddy Emote')).toBeNull();
  });

  it('lists only the emotes the player owns', () => {
    expect(ownedEmotes([])).toEqual([]);
    expect(ownedEmotes(['Confetti Cannon Emote']).map((e) => e.effect)).toEqual(['confetti']);
    expect(ownedEmotes(['Teddy Emote', 'Confetti Cannon Emote'])).toHaveLength(2);
  });

  // The keys are save data and the render lookup: they never change. Only the
  // words a player reads do, so every key has a label and a long form.
  it('labels every cosmetic it can render, and keeps the keys as they were saved', () => {
    expect(RENDERABLE_COSMETICS).toEqual(['Diamond Border', 'Gold Border', 'Teddy Emote', 'Confetti Cannon Emote']);
    expect(Object.keys(COSMETIC_LABELS).sort()).toEqual([...RENDERABLE_COSMETICS].sort());
    for (const key of RENDERABLE_COSMETICS) {
      const { label, long } = COSMETIC_LABELS[key];
      expect(label.length, label).toBeLessThanOrEqual(COSMETIC_LABEL_MAX);
      expect(label, label).not.toMatch(/!/);
      // The long form starts with the label and names what the thing is, so a
      // joke can never hide whether the player is buying a frame or an emote.
      expect(long.startsWith(label), long).toBe(true);
      expect(long, long).toMatch(/\b(card frame|emote)$/);
      expect(long.endsWith(frameFor(key) ? 'card frame' : 'emote'), long).toBe(true);
      expect(cosmeticLabel(key)).toBe(label);
      expect(cosmeticLong(key)).toBe(long);
    }
    // Something this table does not know reads as itself.
    expect(cosmeticLabel('Something Else')).toBe('Something Else');
    expect(cosmeticLong('Something Else')).toBe('Something Else');
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
