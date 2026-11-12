import { describe, it, expect, beforeEach } from 'vitest';
import {
  HERO_LINES, HERO_MAX, FOOTER_LINES, FOOTER_MAX, SHIPPED_FOOTER, TILE_LINES, TILE_MAX, STREAK_MAX,
  streakLine, heroLineForVisit, footerLineForVisit, recordMenuVisit, resetMenuVisits,
} from './menuLines';

const allLines = [
  ...HERO_LINES, ...FOOTER_LINES, ...Object.values(TILE_LINES),
  ...[1, 2, 5, 12, 100].map(streakLine),
];

describe('every line the menu says is tidy', () => {
  it.each(allLines.map((l) => [l]))('%s', (line) => {
    expect(line, 'no stray whitespace').toBe(line.trim());
    expect(line, 'no exclamation marks: the house does not shout').not.toMatch(/!/);
    expect(line, 'no emoji').not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('every line fits the slot it is written for', () => {
  it('the hero line: 31 characters, no full stop at the end', () => {
    expect(HERO_LINES).toHaveLength(10);
    expect(HERO_LINES[0]).toBe('Bad bears · Worse decisions');
    for (const l of HERO_LINES) {
      expect(l.length, l).toBeLessThanOrEqual(HERO_MAX);
      expect(l, l).not.toMatch(/\.$/);
    }
    expect(new Set(HERO_LINES).size).toBe(HERO_LINES.length);
  });

  it('the footer: 44 characters, the shipped line first, nothing about Chuck', () => {
    expect(FOOTER_LINES[0]).toBe(SHIPPED_FOOTER);
    for (const l of FOOTER_LINES) {
      expect(l.length, l).toBeLessThanOrEqual(FOOTER_MAX);
      expect(l, l).not.toMatch(/Chuck/);
    }
  });

  it('the tile lines: 42 characters, and the two that shipped are kept', () => {
    expect(Object.keys(TILE_LINES)).toHaveLength(10);
    for (const l of Object.values(TILE_LINES)) expect(l.length, l).toBeLessThanOrEqual(TILE_MAX);
    expect(TILE_LINES.challenges).toBe('Prove you have a problem');
    expect(TILE_LINES.deck).toBe('Assemble your goon squad');
  });

  it('the streak line: 34 characters, in three tiers, "N-win streak" from two up', () => {
    for (const n of [1, 2, 3, 4, 5, 9, 10, 99, 1000]) expect(streakLine(n).length, `${n}`).toBeLessThanOrEqual(STREAK_MAX);
    expect(new Set([streakLine(1), streakLine(3), streakLine(7)]).size).toBe(3);
    for (const n of [2, 3, 4, 5, 20]) expect(streakLine(n)).toContain(`${n}-win streak`);
    expect(streakLine(4)).toBe(streakLine(2).replace('2-', '4-'));
  });
});

describe('what a visit shows', () => {
  beforeEach(resetMenuVisits);

  it('shows the brand line first, however often it is asked before the menu is up, then never the same line twice in a row', () => {
    // StrictMode asks twice (or more) before anything is on screen.
    expect(heroLineForVisit()).toBe(HERO_LINES[0]);
    expect(heroLineForVisit()).toBe(HERO_LINES[0]);
    let last = HERO_LINES[0];
    recordMenuVisit(last, null);
    for (let i = 0; i < 50; i += 1) {
      const line = heroLineForVisit();
      expect(HERO_LINES).toContain(line);
      expect(line).not.toBe(last);
      expect(line).not.toBe(HERO_LINES[0]);
      recordMenuVisit(line, null);
      last = line;
    }
  });

  it('shows the shipped footer when the closed sign has its own note, and never the same one twice otherwise', () => {
    expect(footerLineForVisit({ closed: true })).toBe(SHIPPED_FOOTER);
    let last = null;
    for (let i = 0; i < 50; i += 1) {
      const line = footerLineForVisit();
      expect(FOOTER_LINES).toContain(line);
      expect(line).not.toBe(last);
      recordMenuVisit(HERO_LINES[0], line);
      last = line;
    }
  });
});
