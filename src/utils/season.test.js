import { SEASON_NAME, SEASON_END, getSeasonDaysLeft } from './season';

const MS_PER_DAY = 86_400_000;

afterEach(() => {
  vi.useRealTimers();
});

describe('season constants', () => {
  it('exposes the expected season name', () => {
    expect(SEASON_NAME).toBe('Season 1: Teddy Rampage');
  });

  it('exposes SEASON_END as the 2026-06-30T23:59:59Z Date', () => {
    expect(SEASON_END).toBeInstanceOf(Date);
    expect(SEASON_END.toISOString()).toBe('2026-06-30T23:59:59.000Z');
  });
});

describe('getSeasonDaysLeft', () => {
  it('returns a non-negative integer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T00:00:00Z'));
    const result = getSeasonDaysLeft();
    expect(result).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('returns 0 exactly at the season end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(SEASON_END);
    expect(getSeasonDaysLeft()).toBe(0);
  });

  it('returns 0 after the season end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SEASON_END.getTime() + 5 * MS_PER_DAY));
    expect(getSeasonDaysLeft()).toBe(0);
  });

  it('never returns negative well past the season end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    expect(getSeasonDaysLeft()).toBeGreaterThanOrEqual(0);
    expect(getSeasonDaysLeft()).toBe(0);
  });

  it('counts the correct whole days for a date before the end', () => {
    // Set "now" to exactly 3 full days before SEASON_END.
    // ceil(3 * dayMs / dayMs) === 3
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SEASON_END.getTime() - 3 * MS_PER_DAY));
    expect(getSeasonDaysLeft()).toBe(3);
  });

  it('rounds up partial days (ceil), e.g. 2.5 days left -> 3', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SEASON_END.getTime() - 2.5 * MS_PER_DAY));
    expect(getSeasonDaysLeft()).toBe(3);
  });

  it('returns 1 when less than a full day remains', () => {
    vi.useFakeTimers();
    // 1 hour before the end -> ceil(small positive) === 1
    vi.setSystemTime(new Date(SEASON_END.getTime() - 60 * 60 * 1000));
    expect(getSeasonDaysLeft()).toBe(1);
  });

  it('matches the manual ceil formula for an arbitrary earlier date', () => {
    vi.useFakeTimers();
    const now = new Date('2026-06-20T12:00:00Z');
    vi.setSystemTime(now);
    const expected = Math.max(
      0,
      Math.ceil((SEASON_END.getTime() - now.getTime()) / MS_PER_DAY),
    );
    expect(getSeasonDaysLeft()).toBe(expected);
  });
});
