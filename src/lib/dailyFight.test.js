import { describe, it, expect } from 'vitest';
import { ALL_CARDS } from '@/stores/gameStore';
import {
  MODIFIERS, CREWS, dailyFightFor, resolveCrew, localDateKey, nextDailyRecord, shouldFatigue, previousLocalDate,
} from './dailyFight';

describe('the nightly fight', () => {
  it('is the same fight for a calendar day, and a different one when the day moves', () => {
    const night = new Date(2026, 10, 6, 23, 30);
    const later = new Date(2026, 10, 6, 23, 59);
    const tomorrow = new Date(2026, 10, 7, 0, 5);
    const a = dailyFightFor(night);
    const b = dailyFightFor(later);
    expect(a.key).toBe(b.key);
    expect(a.modifier.id).toBe(b.modifier.id);
    expect(a.crew.id).toBe(b.crew.id);
    expect(resolveCrew(a.crew, ALL_CARDS)).toHaveLength(8);
    expect(resolveCrew(a.crew, ALL_CARDS).every(Boolean)).toBe(true);
    expect(dailyFightFor(tomorrow).key).not.toBe(a.key);
  });

  it('keeps the rules plain and the joke off the exclamation mark', () => {
    for (const mod of MODIFIERS) {
      expect(mod.rules).not.toMatch(/!/);
      expect(mod.flavour).not.toMatch(/!/);
      expect(mod.rules.length).toBeGreaterThan(10);
    }
    for (const crew of CREWS) {
      expect(crew.cards).toHaveLength(8);
      for (const id of crew.cards) expect(ALL_CARDS.some((card) => card.id === id), String(id)).toBe(true);
    }
  });

  it('dates yesterday in local time', () => {
    expect(previousLocalDate('2026-03-01')).toBe('2026-02-28');
    expect(localDateKey(new Date(2026, 0, 2, 1))).toBe('2026-01-02');
  });

  it('ticks fatigue when the deck is empty or the clock has started, and only once', () => {
    expect(shouldFatigue({ deckEmpty: true, turn: 3, fatigueFromTurn: 8 })).toBe(true);
    expect(shouldFatigue({ deckEmpty: false, turn: 7, fatigueFromTurn: 8 })).toBe(false);
    expect(shouldFatigue({ deckEmpty: false, turn: 8, fatigueFromTurn: 8 })).toBe(true);
    expect(shouldFatigue({ deckEmpty: true, turn: 9, fatigueFromTurn: 8 })).toBe(true);
  });

  it('counts a streak in local nights and will not book tonight twice', () => {
    const first = nextDailyRecord({}, true, '2026-11-06');
    expect(first).toMatchObject({ dailyKey: '2026-11-06', dailyResult: 'win', dailyStreak: 1, dailyBest: 1 });
    const second = nextDailyRecord(first, true, '2026-11-07');
    expect(second.dailyStreak).toBe(2);
    expect(second.dailyBest).toBe(2);
    expect(nextDailyRecord(second, true, '2026-11-07')).toBeNull();
    const skipped = nextDailyRecord(second, true, '2026-11-09');
    expect(skipped.dailyStreak).toBe(1);
    const loss = nextDailyRecord(second, false, '2026-11-08');
    expect(loss).toMatchObject({ dailyResult: 'loss', dailyStreak: 0, dailyBest: 2 });
  });
});
