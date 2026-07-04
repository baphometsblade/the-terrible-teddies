import { SEASON_NAMES, getCurrentSeason, getSeasonDaysLeft } from './season';

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
    // Season 5 starts 4 quarters after Season 1 → Apr 2027, name wraps to index 0.
    const s = getCurrentSeason(new Date('2027-05-01T00:00:00Z'));
    expect(s.number).toBe(5);
    expect(s.name).toBe(`Season 5: ${SEASON_NAMES[0]}`);
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
