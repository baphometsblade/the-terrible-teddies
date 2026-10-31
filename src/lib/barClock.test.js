import { describe, it, expect, afterEach, vi } from 'vitest';
import { BAR_CLOCK, CLOSED_NOTES, SIGN_MAX, NOTE_MAX, SUBTITLE_MAX, signFor, subtitleFor, partOfDay } from './barClock';
import { MGMT_SIGNOFF } from './mgmtNotes';

const row = (id) => BAR_CLOCK.find((r) => r.id === id);

// A time on the player's own wall clock: local, because the sign follows the
// hour the clock shows.
const at = (hour, minute = 0) => new Date(2026, 9, 31, hour, minute);

// The brief's table, restated by hour, independently of the rows' from/until:
// 6-12 early, 12-16 afternoon, 16-19 happy hour, 19-1 late, 1-2 last call,
// 2-6 closed.
const EXPECTED = Object.fromEntries([
  ...[6, 7, 8, 9, 10, 11].map((h) => [h, 'early']),
  ...[12, 13, 14, 15].map((h) => [h, 'afternoon']),
  ...[16, 17, 18].map((h) => [h, 'happyHour']),
  ...[19, 20, 21, 22, 23, 0].map((h) => [h, 'late']),
  [1, 'lastCall'],
  ...[2, 3, 4, 5].map((h) => [h, 'closed']),
]);

describe('the table', () => {
  it('has the six parts of the night, in the order the day runs', () => {
    expect(BAR_CLOCK.map((r) => r.id)).toEqual(['early', 'afternoon', 'happyHour', 'late', 'lastCall', 'closed']);
  });

  it('holds every hour of the day in exactly one row', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const rows = BAR_CLOCK.filter((r) => (r.from < r.until ? hour >= r.from && hour < r.until : hour >= r.from || hour < r.until));
      expect(rows.map((r) => r.id), `hour ${hour}`).toEqual([EXPECTED[hour]]);
    }
  });

  it('uses only tones and lights the neon material knows', () => {
    for (const row of BAR_CLOCK) {
      expect(['amber', 'pink', 'teal', 'red'], row.id).toContain(row.tone);
      expect(['full', 'half'], row.id).toContain(row.lit);
    }
  });

  // One flickering sign in the whole game: last call, 1 a.m.
  it('flickers for last call and nothing else', () => {
    expect(BAR_CLOCK.filter((r) => r.flicker).map((r) => r.id)).toEqual(['lastCall']);
    expect(BAR_CLOCK.find((r) => r.id === 'lastCall').tone).toBe('pink');
  });

  // Closed is half lit, in red, with a note taped under it; no other sign has
  // either.
  it('is half lit in red with a note, for the small hours only', () => {
    const closed = BAR_CLOCK.find((r) => r.id === 'closed');
    expect(closed).toMatchObject({ sign: 'CLOSED', tone: 'red', lit: 'half' });
    expect(closed.note).toBeTruthy();
    expect(BAR_CLOCK.filter((r) => r.note).map((r) => r.id)).toEqual(['closed']);
    expect(BAR_CLOCK.filter((r) => r.lit === 'half').map((r) => r.id)).toEqual(['closed']);
  });
});

describe('every line fits its slot', () => {
  it.each(BAR_CLOCK.map((r) => [r.id, r]))('%s', (_id, row) => {
    // The neon sign is set in caps and holds a few words.
    expect(row.sign.length, 'sign').toBeGreaterThan(0);
    expect(row.sign.length, 'sign').toBeLessThanOrEqual(SIGN_MAX);
    expect(row.sign, 'sign is written in caps').toBe(row.sign.toUpperCase());
    // The Battle button's text column holds 20 characters at its 260px minimum.
    expect(row.subtitle.length, 'subtitle').toBeGreaterThan(0);
    expect(row.subtitle.length, 'subtitle').toBeLessThanOrEqual(SUBTITLE_MAX);
    if (row.note !== null) {
      expect(row.note.length, 'note').toBeGreaterThan(0);
      expect(row.note.length, 'note').toBeLessThanOrEqual(NOTE_MAX);
    }
    // No stray whitespace round a line, and no empty lines.
    for (const line of [row.sign, row.subtitle, row.note].filter((l) => l !== null)) {
      expect(line, line).toBe(line.trim());
    }
  });

  it('keeps the budgets the layout was built on', () => {
    expect([SIGN_MAX, NOTE_MAX, SUBTITLE_MAX]).toEqual([14, 28, 20]);
  });
});

describe('the boundary hours', () => {
  const cases = [
    [5, 'closed'], [6, 'early'],
    [11, 'early'], [12, 'afternoon'],
    [15, 'afternoon'], [16, 'happyHour'],
    [18, 'happyHour'], [19, 'late'],
    [23, 'late'], [0, 'late'],
    [1, 'lastCall'], [2, 'closed'],
  ];
  it.each(cases)('at %i:00 it is %s', (hour, id) => {
    expect(partOfDay(at(hour))).toBe(id);
    expect(signFor(at(hour)).state).toBe(id);
    // ...to the last minute of the hour.
    expect(partOfDay(at(hour, 59))).toBe(id);
  });

  it('is right for every hour of the day', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(partOfDay(at(hour, 30)), `hour ${hour}`).toBe(EXPECTED[hour]);
    }
  });
});

describe('signFor', () => {
  // The expectations are read from the table, so the next rewrite of the
  // lines moves one file; only the structure (tone, light, flicker) is pinned.
  it('answers with the sign for the hour', () => {
    expect(signFor(at(10))).toEqual({ state: 'early', text: row('early').sign, tone: 'amber', lit: 'full', flicker: false, note: null });
    expect(signFor(at(13))).toMatchObject({ state: 'afternoon', text: row('afternoon').sign, tone: 'amber' });
    expect(signFor(at(17))).toMatchObject({ state: 'happyHour', text: row('happyHour').sign, tone: 'pink' });
    expect(signFor(at(22))).toMatchObject({ state: 'late', text: row('late').sign, tone: 'teal' });
    expect(signFor(at(1, 30))).toMatchObject({ state: 'lastCall', text: row('lastCall').sign, tone: 'pink', flicker: true });
    expect(signFor(at(3))).toMatchObject({ state: 'closed', text: row('closed').sign, tone: 'red', lit: 'half' });
    expect(signFor(at(3)).note).toBe(row('closed').note);
  });

  it('takes a Date or an epoch, and the clock when it is given nothing', () => {
    expect(signFor(at(17).getTime()).state).toBe('happyHour');
    expect(signFor(at(17)).state).toBe('happyHour');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(at(1, 15));
      expect(signFor().state).toBe('lastCall');
      expect(subtitleFor()).toBe(row('lastCall').subtitle);
      vi.setSystemTime(at(14));
      expect(signFor().state).toBe('afternoon');
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands out its own copy, not the table's row", () => {
    const sign = signFor(at(3));
    sign.text = 'MUTATED';
    expect(signFor(at(3)).text).toBe(row('closed').sign);
  });
});

describe('subtitleFor', () => {
  it('follows the same clock as the sign', () => {
    expect(subtitleFor(at(9))).toBe(row('early').subtitle);
    expect(subtitleFor(at(14))).toBe(row('afternoon').subtitle);
    expect(subtitleFor(at(17))).toBe(row('happyHour').subtitle);
    expect(subtitleFor(at(21))).toBe(row('late').subtitle);
    expect(subtitleFor(at(1))).toBe(row('lastCall').subtitle);
    expect(subtitleFor(at(4))).toBe(row('closed').subtitle);
  });

  // Nothing already shipped disappears: the Battle button's original line is
  // the late row's, the busiest six hours of the evening.
  it('keeps the shipped "Go make Chuck cry", for the evening', () => {
    for (const hour of [19, 20, 21, 22, 23, 0]) expect(subtitleFor(at(hour))).toBe('Go make Chuck cry');
  });

  it("is a line for every hour, within the button's width", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const line = subtitleFor(at(hour));
      expect(line.length, `hour ${hour}`).toBeGreaterThan(0);
      expect(line.length, `hour ${hour}`).toBeLessThanOrEqual(SUBTITLE_MAX);
    }
  });

  // A single sentence carries no full stop (the deck measured 'Go make Chuck
  // cry.' at 154px against a 152px column).
  it('ends no single-sentence line with a full stop', () => {
    for (const r of BAR_CLOCK) expect(r.subtitle, r.id).not.toMatch(/\.$/);
  });
});

describe("the closed sign's notes", () => {
  it('are signed by management, fit the slot and are all different', () => {
    expect(CLOSED_NOTES.length).toBeGreaterThanOrEqual(5);
    for (const n of CLOSED_NOTES) {
      expect(n.endsWith(MGMT_SIGNOFF), n).toBe(true);
      expect(n.length, n).toBeLessThanOrEqual(NOTE_MAX);
      expect(n, n).toBe(n.trim());
    }
    expect(new Set(CLOSED_NOTES).size).toBe(CLOSED_NOTES.length);
  });

  it("start with the table's own note", () => {
    expect(row('closed').note).toBe(CLOSED_NOTES[0]);
  });
});

// The night the clocks go forward or back, the wall clock still decides: the
// hour the player sees is the sign they get.
describe('daylight saving', () => {
  const realZone = process.env.TZ;
  afterEach(() => {
    if (realZone === undefined) delete process.env.TZ;
    else process.env.TZ = realZone;
  });

  it('follows the wall clock across the spring jump', () => {
    process.env.TZ = 'America/New_York';
    // 01:59 EST, then 03:00 EDT a minute later: the 2 a.m. hour never happens.
    const before = new Date('2026-03-08T06:59:00Z');
    const after = new Date('2026-03-08T07:00:00Z');
    expect([before.getHours(), after.getHours()]).toEqual([1, 3]);
    expect(partOfDay(before)).toBe('lastCall');
    expect(partOfDay(after)).toBe('closed');
  });

  it('shows last call in both of the 1 a.m. hours the autumn night has', () => {
    process.env.TZ = 'America/New_York';
    const first = new Date('2026-11-01T05:30:00Z'); // 01:30 EDT
    const second = new Date('2026-11-01T06:30:00Z'); // 01:30 EST, an hour later
    expect([first.getHours(), second.getHours()]).toEqual([1, 1]);
    expect(partOfDay(first)).toBe('lastCall');
    expect(partOfDay(second)).toBe('lastCall');
    expect(partOfDay(new Date('2026-11-01T07:00:00Z'))).toBe('closed'); // 02:00 EST
  });
});
