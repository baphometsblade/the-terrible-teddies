import { describe, it, expect } from 'vitest';
import {
  MGMT_NOTES, MGMT_SIGNOFF, MGMT_NOTE_MAX, FOOTER_NOTES, EMPTY_STATE_NOTES, CHUCK_NOTES, pickLine,
} from './mgmtNotes';

describe('the notes from management', () => {
  it("has the deck's 23 notes: 17 for the menu's footer, 1 for empty states, 5 that name Chuck", () => {
    expect(MGMT_NOTES).toHaveLength(23);
    expect(FOOTER_NOTES).toHaveLength(17);
    expect(EMPTY_STATE_NOTES).toHaveLength(1);
    expect(CHUCK_NOTES).toHaveLength(5);
  });

  it('signs every note with the one constant, and fits the slot with the sign-off in it', () => {
    expect(MGMT_SIGNOFF).toBe(' - Mgmt.');
    for (const { text } of MGMT_NOTES) {
      expect(text.endsWith(MGMT_SIGNOFF), text).toBe(true);
      expect(text.length, text).toBeLessThanOrEqual(MGMT_NOTE_MAX);
      expect(text, text).toBe(text.trim());
    }
  });

  it('never repeats a note, and never talks about paying', () => {
    const texts = MGMT_NOTES.map((n) => n.text);
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) expect(t, t).not.toMatch(/\b(pay|paid|price|refund|gems?|coins?)\b|\$/i);
  });

  // Chuck has the Battle button's line; the menu's footer stays off him.
  it("keeps Chuck out of the menu's footer, and only there", () => {
    for (const t of FOOTER_NOTES) expect(t).not.toMatch(/Chuck/);
    for (const t of CHUCK_NOTES) expect(t).toMatch(/Chuck/);
  });
});

describe('pickLine', () => {
  const pool = ['a', 'b', 'c'];
  it('picks from the pool, whatever the random is', () => {
    for (const r of [0, 0.34, 0.99, 1]) expect(pool).toContain(pickLine(pool, null, () => r));
  });
  it('never repeats the line it is told to avoid, when there is another', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) expect(pickLine(pool, 'b', () => r)).not.toBe('b');
  });
  it('answers with the only line a pool of one has, even when asked to avoid it', () => {
    expect(pickLine(['only'], 'only')).toBe('only');
  });
});
