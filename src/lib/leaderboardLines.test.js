import { describe, it, expect } from 'vitest';
import { YOU_LINES, YOU_LINE_MAX, LEADERBOARD_COPY, youLine } from './leaderboardLines';

describe('the line under the player\'s own row', () => {
  it('fits its slot, carries no number and no exclamation mark', () => {
    for (const [bucket, line] of Object.entries(YOU_LINES)) {
      expect(line.length, bucket).toBeLessThanOrEqual(YOU_LINE_MAX);
      // A number could contradict the row above it.
      expect(line, bucket).not.toMatch(/\d/);
      expect(line, bucket).not.toMatch(/!/);
    }
    expect(new Set(Object.values(YOU_LINES)).size).toBe(Object.keys(YOU_LINES).length);
  });

  it('picks by rank bucket', () => {
    expect(youLine(1)).toBe(YOU_LINES.first);
    expect(youLine(2)).toBe(YOU_LINES.podium);
    expect(youLine(3)).toBe(YOU_LINES.podium);
    expect(youLine(4)).toBe(YOU_LINES.topTen);
    expect(youLine(10)).toBe(YOU_LINES.topTen);
    expect(youLine(11)).toBe(YOU_LINES.board);
    expect(youLine(50)).toBe(YOU_LINES.board);
    // Past the rows fetched: the '50+' badge, or a real rank from get_my_rank.
    expect(youLine('50+')).toBe(YOU_LINES.outside);
    expect(youLine(73)).toBe(YOU_LINES.outside);
  });

  it('says nothing while the rank is unknown', () => {
    for (const unknown of ['—', null, undefined, 0, -1, NaN, 'x']) expect(youLine(unknown), String(unknown)).toBeNull();
  });
});

describe('the leaderboard copy', () => {
  it('signs the error off the way every other Mgmt note is signed, and keeps the caption to one line', () => {
    expect(LEADERBOARD_COPY.errorSignoff).toBe('Not you. Probably. — Mgmt.');
    expect(LEADERBOARD_COPY.caption.length).toBeLessThanOrEqual(18);
    expect(LEADERBOARD_COPY.fallbackName.length).toBeLessThanOrEqual(20);
    for (const line of Object.values(LEADERBOARD_COPY)) expect(line).not.toMatch(/!/);
  });
});
