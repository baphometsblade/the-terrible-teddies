import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS } from './gameStore';
import { ACHIEVEMENT_TOAST_TITLE, plainAchievementToast } from '@/lib/achievementAnnouncements';

// The House's names and captions, held to the slots they fill. The toast's
// width is the arbiter (e2e/meta-screens.spec.js measures the longest name at
// four widths over a dialog); these are the first checks from the table.

describe('achievement names and captions', () => {
  it('gives every achievement a name, and names none twice', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.name)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.name, a.id).toBe(a.name.trim());
      expect(a.name.length, a.name).toBeLessThanOrEqual(22);
      expect(a.name, a.name).not.toMatch(/!/);
      expect(a.name, a.name).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  // The criterion (description) stays literal and plain; the caption is the
  // House's, drawn only while the row is locked.
  it('captions every achievement, one short line, curly apostrophes only', () => {
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.locked, a.id).toBe('string');
      expect(a.locked.length, a.locked).toBeGreaterThan(0);
      expect(a.locked.length, a.locked).toBeLessThanOrEqual(30);
      expect(a.locked, a.locked).not.toContain("'");
      expect(a.locked, a.locked).not.toMatch(/!/);
    }
    expect(new Set(ACHIEVEMENTS.map((a) => a.locked)).size).toBe(ACHIEVEMENTS.length);
  });

  // The criteria are the rules; no caption may stand in for one.
  it('leaves the criteria plain', () => {
    for (const a of ACHIEVEMENTS) expect(a.description, a.id).toMatch(/^(Win|Collect|Play|Deal|Heal|Reach|Log in)\b/);
  });

  it('enters every unlock under one title, as "name — +N coins"', () => {
    expect(ACHIEVEMENT_TOAST_TITLE).toBe('Behavior noted');
    for (const a of ACHIEVEMENTS) {
      const t = plainAchievementToast(a);
      expect(t.title).toBe(ACHIEVEMENT_TOAST_TITLE);
      expect(t.description).toBe(`${a.name} — +${a.reward.toLocaleString()} coins`);
    }
    // The title never appears inside a name, which the burst e2e relies on.
    for (const a of ACHIEVEMENTS) expect(a.name).not.toContain(ACHIEVEMENT_TOAST_TITLE);
  });
});
