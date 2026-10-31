import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOUSE_RANKS, RANK_NAME_MAX, RANK_PROMOTED_MAX, houseRank, rankUp, rankSpan,
} from './houseRank';
import { SAVE_FIELDS } from '@/stores/gameStore';

// A rank is derived from the level, and every word of it sits in one table, so
// the ladder can be rewritten without touching a screen. These tests hold the
// table to the slots its words go in, and the lookups to the table (never to a
// number typed here) — except the one test that pins the shipped rungs, which
// is the one to change on purpose when the ladder is retuned.

describe('the table', () => {
  it('starts at level 1 and climbs, so every level has a rank', () => {
    expect(HOUSE_RANKS[0].min).toBe(1);
    HOUSE_RANKS.forEach((row, i) => {
      expect(Number.isInteger(row.min), `${row.name}.min`).toBe(true);
      if (i > 0) expect(row.min, `${row.name} climbs past ${HOUSE_RANKS[i - 1].name}`).toBeGreaterThan(HOUSE_RANKS[i - 1].min);
    });
  });

  // The one pin on the shipped numbers. Retune the ladder, change this.
  it('is the ladder that ships: a rung every five levels from 5', () => {
    expect(HOUSE_RANKS.map((r) => [r.min, r.name])).toEqual([
      [1, 'Walk-In'], [5, 'Regular'], [10, 'Has a Usual'], [15, 'Barfly'], [20, 'Fixture'], [25, 'Part of the Furniture'],
    ]);
  });

  it('gives every rung a name and a promotion line that fit their slots', () => {
    for (const row of HOUSE_RANKS) {
      expect(row.name.trim(), 'a rung without a name').not.toBe('');
      expect(row.promoted.trim(), `${row.name} has no promotion line`).not.toBe('');
      expect(row.name.length, `${row.name} is over its label`).toBeLessThanOrEqual(RANK_NAME_MAX);
      expect(row.promoted.length, `"${row.promoted}" is over its line`).toBeLessThanOrEqual(RANK_PROMOTED_MAX);
      // Trimmed, so the toast's join and the label's separator add the only spaces.
      expect(row.name).toBe(row.name.trim());
      expect(row.promoted).toBe(row.promoted.trim());
    }
  });

  it('names no rank twice', () => {
    expect(new Set(HOUSE_RANKS.map((r) => r.name)).size).toBe(HOUSE_RANKS.length);
    expect(new Set(HOUSE_RANKS.map((r) => r.promoted)).size).toBe(HOUSE_RANKS.length);
  });

  // The game sells a Premium Pass; a rank that sounds like a tier you can buy
  // would be taken for one.
  it('reads like nothing a player can pay for', () => {
    for (const row of HOUSE_RANKS) {
      expect(`${row.name} ${row.promoted}`).not.toMatch(/\b(vip|member(ship)?|premium|gold|silver|platinum|elite|pass|club|pro)\b/i);
    }
  });

  it('is frozen, so a screen cannot rewrite the ladder', () => {
    expect(Object.isFrozen(HOUSE_RANKS)).toBe(true);
    expect(HOUSE_RANKS.every((row) => Object.isFrozen(row))).toBe(true);
  });
});

describe('houseRank', () => {
  it('holds each rung from its first level to the one before the next', () => {
    HOUSE_RANKS.forEach((row, i) => {
      expect(houseRank(row.min)).toBe(row);
      const next = HOUSE_RANKS[i + 1];
      if (next) {
        expect(houseRank(next.min - 1), `the level before ${next.name}`).toBe(row);
        expect(houseRank(next.min)).toBe(next);
      }
    });
  });

  it('has a rank for every level from 1 to 200, never stepping down as the level rises', () => {
    let last = -1;
    for (let level = 1; level <= 200; level++) {
      const row = houseRank(level);
      expect(row, `level ${level} has no rank`).toBeTruthy();
      const at = HOUSE_RANKS.indexOf(row);
      expect(at, `level ${level} fell back a rung`).toBeGreaterThanOrEqual(last);
      last = at;
    }
    // The top rung has no end.
    expect(houseRank(200)).toBe(HOUSE_RANKS[HOUSE_RANKS.length - 1]);
  });

  it('gives a level that is not a level the first rung rather than nothing', () => {
    for (const odd of [0, -3, NaN, undefined, null, 'x']) expect(houseRank(odd), String(odd)).toBe(HOUSE_RANKS[0]);
    expect(houseRank(HOUSE_RANKS[1].min + 0.9)).toBe(HOUSE_RANKS[1]);
    expect(houseRank(String(HOUSE_RANKS[1].min))).toBe(HOUSE_RANKS[1]);
    expect(houseRank(Infinity)).toBe(HOUSE_RANKS[HOUSE_RANKS.length - 1]);
  });
});

describe('rankUp', () => {
  it('promotes on the level that reaches a rung, and on no other', () => {
    HOUSE_RANKS.slice(1).forEach((row) => {
      expect(rankUp(row.min - 1, row.min), `reaching ${row.name}`).toBe(row);
      // One level on from the threshold is a level-up inside the rung.
      expect(rankUp(row.min, row.min + 1), `leaving ${row.name}'s first level`).toBeNull();
    });
    expect(rankUp(1, 2)).toBeNull();
  });

  it('says one promotion for a jump over several rungs, the highest it reached', () => {
    const last = HOUSE_RANKS[HOUSE_RANKS.length - 1];
    expect(rankUp(1, last.min)).toBe(last);
    expect(rankUp(1, 200)).toBe(last);
    const [, second, third] = HOUSE_RANKS;
    expect(rankUp(second.min - 1, third.min)).toBe(third);
    // A jump that stays inside a rung promotes nobody, however many levels it is.
    const [first] = HOUSE_RANKS;
    expect(rankUp(first.min, second.min - 1)).toBeNull();
  });

  it('never promotes a level that did not rise', () => {
    for (const row of HOUSE_RANKS) {
      expect(rankUp(row.min, row.min)).toBeNull();
      expect(rankUp(row.min + 1, row.min - 1 || 1)).toBeNull();
    }
    // Down the whole ladder, as a reset would.
    expect(rankUp(200, 1)).toBeNull();
  });

  it('never promotes to the first rung: nobody is promoted into walking in', () => {
    for (let from = 1; from <= 30; from++) expect(rankUp(from, 1)).toBeNull();
  });
});

describe('rankSpan', () => {
  it('says which levels a rank covers, from the table', () => {
    HOUSE_RANKS.forEach((row, i) => {
      const next = HOUSE_RANKS[i + 1];
      expect(rankSpan(row.min)).toEqual({ from: row.min, to: next ? next.min - 1 : null });
      if (next) expect(rankSpan(next.min - 1)).toEqual({ from: row.min, to: next.min - 1 });
    });
  });

  it('has no end on the top rung', () => {
    expect(rankSpan(500).to).toBeNull();
  });
});

describe('what a rank is not', () => {
  // Derived from the level, so there is nothing to save: no store field holds
  // it, which keeps it out of the cloud save and the reset by construction.
  it('is stored nowhere', () => {
    expect(SAVE_FIELDS.filter((field) => /^(house)?rank(name)?$/i.test(field))).toEqual([]);
  });

  // App's toast imports it on the boot path, so it takes no imports itself: a
  // store import here would drag the whole store in beside it.
  it('imports nothing', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/houseRank.js'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
