import { describe, it, expect } from 'vitest';
import { fatigueForEmptyDraw, fatigueLine } from './fatigue';

describe('fatigue', () => {
  it('escalates by one per empty draw, starting at 1', () => {
    expect(fatigueForEmptyDraw(0)).toBe(1);
    expect(fatigueForEmptyDraw(1)).toBe(2);
    expect(fatigueForEmptyDraw(4)).toBe(5);
  });

  it('says the damage in the log, for both sides', () => {
    expect(fatigueLine('player', 1)).toBe('Your keg is dry. Fatigue 1. You take 1.');
    expect(fatigueLine('opponent', 3, 'Chuck')).toBe("Chuck's keg is dry. Fatigue 3. He takes 3.");
    expect(fatigueLine('player', 2).length).toBeLessThanOrEqual(90);
  });
});
