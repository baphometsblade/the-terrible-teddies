import { SEASON_NAMES, SEASON_NAME_MAX, getCurrentSeason, getSeasonDaysLeft, getSeason, seasonFromKey, formatSeasonEnd } from './season';

afterEach(() => {
  vi.useRealTimers();
});

describe('getCurrentSeason (rolling quarterly seasons)', () => {
  it('identifies Season 1 (Teddy Rampage) during Apr–Jun 2026', () => {
    const s = getCurrentSeason(new Date('2026-05-15T12:00:00Z'));
    expect(s.number).toBe(1);
    expect(s.name).toBe('Season 1: Teddy Rampage');
    expect(s.key).toBe('season-1');
    expect(s.endDate.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('rolls to Season 2 (Fluffpocalypse) after June 2026', () => {
    const s = getCurrentSeason(new Date('2026-07-04T12:00:00Z'));
    expect(s.number).toBe(2);
    expect(s.name).toBe('Season 2: Fluffpocalypse');
    expect(s.endDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('the boundary instant belongs to the new season with a full quarter left', () => {
    const before = getCurrentSeason(new Date('2026-06-30T23:59:00Z'));
    expect(before.number).toBe(1);
    expect(before.daysLeft).toBe(1);

    const at = getCurrentSeason(new Date('2026-07-01T00:00:00Z'));
    expect(at.number).toBe(2);
    expect(at.daysLeft).toBeGreaterThan(80); // full Jul–Sep quarter ahead
  });

  it('season names cycle after the list is exhausted', () => {
    // The list holds one name per quarter from Season 1; the season after the
    // last name starts that many quarters after Season 1 and wraps to index 0.
    const n = SEASON_NAMES.length;
    const s = getSeason(n + 1);
    expect(s.number).toBe(n + 1);
    expect(s.name).toBe(`Season ${n + 1}: ${SEASON_NAMES[0]}`);
    expect(getSeason(n + 2).name).toBe(`Season ${n + 2}: ${SEASON_NAMES[1]}`);
    // And the clock agrees with the number: Season 5 starts in April 2027.
    expect(getCurrentSeason(new Date('2027-05-01T00:00:00Z')).number).toBe(5);
  });

  // Seasons 1-3 are past or live and keep their names. Season 3 (Oct-Dec
  // 2026) is running now and must never be renamed; the deck's names start at
  // Season 4 (1 Jan 2027).
  it('never renames Seasons 1 to 3, and names Season 4 onwards from the deck', () => {
    expect(getSeason(1).name).toBe('Season 1: Teddy Rampage');
    expect(getSeason(2).name).toBe('Season 2: Fluffpocalypse');
    expect(getSeason(3).name).toBe('Season 3: Stuffing Storm');
    expect(getSeason(4).name).toBe('Season 4: Damp January');
    expect(getSeason(19).name).toBe('Season 19: Holiday Blackout');
  });

  it('holds every name to its slot and names no season twice', () => {
    for (const name of SEASON_NAMES) {
      expect(name.length, name).toBeLessThanOrEqual(SEASON_NAME_MAX);
      expect(name, name).toBe(name.trim());
      expect(name, `${name} carries an exclamation mark`).not.toMatch(/!/);
    }
    expect(new Set(SEASON_NAMES).size).toBe(SEASON_NAMES.length);
  });

  it('daysLeft counts whole days, rounding partial days up', () => {
    // 2026-09-28T12:00Z → 2.5 days to Oct 1 → 3
    expect(getCurrentSeason(new Date('2026-09-28T12:00:00Z')).daysLeft).toBe(3);
    // one hour before the boundary → 1
    expect(getCurrentSeason(new Date('2026-09-30T23:00:00Z')).daysLeft).toBe(1);
  });

  it('the countdown can never go stale: daysLeft is at least 1 mid-season', () => {
    for (const iso of ['2026-07-04T12:00:00Z', '2026-12-31T23:00:00Z', '2030-02-14T08:00:00Z']) {
      expect(getCurrentSeason(new Date(iso)).daysLeft).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('getSeasonDaysLeft', () => {
  it('reflects the current rolling season based on the real clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
    expect(getSeasonDaysLeft()).toBe(getCurrentSeason(new Date('2026-07-04T12:00:00Z')).daysLeft);
    expect(getSeasonDaysLeft()).toBeGreaterThan(0);
  });
});

describe('getSeason / seasonFromKey', () => {
  it('names and bounds any season by number, matching the current-season reading', () => {
    const now = new Date('2026-11-02T12:00:00Z');
    const current = getCurrentSeason(now);
    const byNumber = getSeason(current.number);
    expect(byNumber).toMatchObject({ number: 3, key: 'season-3', name: current.name });
    expect(byNumber.startDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(byNumber.endDate.toISOString()).toBe(current.endDate.toISOString());
  });

  // A save is stamped with its season's key; a rollover names the season
  // whose rewards it delivers from that key.
  it('reads a store key back to its season, and nothing else', () => {
    expect(seasonFromKey('season-1').name).toBe('Season 1: Teddy Rampage');
    expect(seasonFromKey('season-6').name).toBe(`Season 6: ${SEASON_NAMES[5]}`);
    for (const key of [null, undefined, '', 'season-0', 'season-x', 'winter']) expect(seasonFromKey(key)).toBeNull();
  });
});

describe('formatSeasonEnd', () => {
  // The season ends at midnight UTC: a bare date was a day out west of it.
  it('says the end in the player’s own clock, with the time', () => {
    const end = getSeason(3).endDate; // 2027-01-01T00:00Z
    expect(formatSeasonEnd(end, { locale: 'en-US', timeZone: 'America/Los_Angeles' })).toBe('Dec 31, 4:00 PM');
    expect(formatSeasonEnd(end, { locale: 'en-US', timeZone: 'UTC' })).toBe('Jan 1, 12:00 AM');
  });
});
