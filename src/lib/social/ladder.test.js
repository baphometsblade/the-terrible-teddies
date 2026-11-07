import { describe, expect, it } from 'vitest';
import {
  LADDER_TIERS, TIER_ASIDES, tierAt, softReset, eloDelta, capGain, seasonId,
  deckProblem, cleanCode, safeName, challengePath, challengeUrl, PUBLIC_ORIGIN, DECK_SIZE,
} from './ladder';

describe('ladder tiers', () => {
  it('names every rung, in order, with an aside that stays off a shared card', () => {
    expect(LADDER_TIERS.map((row) => row.name)).toEqual([
      'Warming Up', 'Getting Handsy', 'Regular', 'Easy', 'Back Booth',
      'After Hours', 'Last Call', 'All Night',
    ]);
    for (const row of LADDER_TIERS) {
      expect(TIER_ASIDES[row.name], row.name).toEqual(expect.any(String));
      expect(row.name.length, row.name).toBeLessThanOrEqual(16);
    }
  });

  it('holds the boundary ratings', () => {
    expect(tierAt(1049).name).toBe('Warming Up');
    expect(tierAt(1050).name).toBe('Getting Handsy');
    expect(tierAt(1199).name).toBe('Getting Handsy');
    expect(tierAt(1200).name).toBe('Regular');
    expect(tierAt(1999).name).toBe('Last Call');
    expect(tierAt(2000).name).toBe('All Night');
    expect(tierAt(99999).name).toBe('All Night');
    expect(tierAt(undefined).name).toBe('Warming Up');
  });
});

describe('season and rating math, matching the migration', () => {
  it('prints the ISO week in UTC', () => {
    expect(seasonId(new Date('2026-11-07T12:00:00Z'))).toBe('2026-W45');
    expect(seasonId(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    expect(seasonId(new Date('2021-01-01T00:00:00Z'))).toBe('2020-W53');
    expect(seasonId(new Date('2025-12-31T12:00:00Z'))).toBe('2026-W01');
  });

  it('walks a rating halfway back to 1000', () => {
    expect(softReset(1400)).toBe(1200);
    expect(softReset(900)).toBe(950);
    expect(softReset(1000)).toBe(1000);
    expect(softReset(100)).toBe(550);
    expect(softReset(Number.NaN)).toBe(1000);
  });

  it('steps Elo the way ladder_delta does', () => {
    expect(eloDelta(1000, 1000, true)).toBe(12);
    expect(eloDelta(1000, 1000, false)).toBe(-12);
    expect(eloDelta(1000, 1400, true)).toBe(22);
    expect(eloDelta(1400, 1000, true)).toBe(2);
  });

  it('caps a day of gains and lets a loss through', () => {
    expect(capGain(12, 72)).toBe(8);
    expect(capGain(12, 80)).toBe(0);
    expect(capGain(-12, 80)).toBe(-12);
  });
});

describe('decks and codes', () => {
  const known = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  it('accepts ten real cards and two copies', () => {
    expect(deckProblem([1, 1, 2, 3, 4, 5, 6, 7, 8, 9], known)).toBeNull();
  });

  it('refuses a short deck, a third copy, and a card the catalog does not have', () => {
    expect(deckProblem([1, 2, 3], known)).toMatch(/10 cards/);
    expect(deckProblem([1, 1, 1, 2, 3, 4, 5, 6, 7, 8], known)).toMatch(/Two copies/);
    expect(deckProblem([1, 2, 3, 4, 5, 6, 7, 8, 9, 99], known)).toMatch(/does not serve/);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).toHaveLength(DECK_SIZE);
  });

  it('keeps a challenge code and a display name boring', () => {
    expect(cleanCode(' AbCDef1234 ')).toBe('abcdef1234');
    expect(cleanCode('nope')).toBe('');
    expect(cleanCode('<script>')).toBe('');
    expect(safeName('Ada')).toBe('Ada');
    expect(safeName('<b>Ada</b>')).toBe('A rival');
    expect(challengePath('abcdef1234')).toBe('/duel/abcdef1234');
    expect(challengePath('nope')).toBe('');
    expect(challengeUrl('abcdef1234')).toBe(`${PUBLIC_ORIGIN}/duel/abcdef1234`);
    expect(PUBLIC_ORIGIN).toBe('https://terribleteddies.vercel.app');
  });
});
