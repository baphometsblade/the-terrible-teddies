import { describe, it, expect } from 'vitest';
import { BAR_CLOCK, partOfDay } from './barClock';
import {
  DAILY_KICKERS, KICKER_MAX, DAILY_PAID_SUBS, PAID_SUB_MAX, CARD_DAY_LEAD_IN, dayReadyTitle, pickKicker, pickPaidSub,
} from './dailyLines';

// Every line is measured against the slot it fills, from the tables.
const at = (hour) => new Date(2026, 9, 31, hour, 30);

describe('the Daily kickers', () => {
  // The bands are the menu sign's own: a second table could drift from it.
  it('has a pool for every part of the night the bar clock names, and no other', () => {
    expect(Object.keys(DAILY_KICKERS).sort()).toEqual(BAR_CLOCK.map((r) => r.id).sort());
  });

  it('holds every line to its slot: short, plain-spaced, no exclamation mark', () => {
    for (const [band, lines] of Object.entries(DAILY_KICKERS)) {
      expect(lines.length, band).toBeGreaterThanOrEqual(2);
      for (const line of lines) {
        expect(line.length, line).toBeLessThanOrEqual(KICKER_MAX);
        expect(line, line).toBe(line.trim());
        expect(line, line).not.toMatch(/!/);
        expect(line, line).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(line, line).not.toContain("'");
      }
    }
  });

  it('draws from the band the hour is in', () => {
    for (let hour = 0; hour < 24; hour++) {
      const now = at(hour);
      expect(DAILY_KICKERS[partOfDay(now)], `hour ${hour}`).toContain(pickKicker(now));
    }
  });

  it('never deals the same line twice running', () => {
    const now = at(20);
    let previous = pickKicker(now);
    for (let i = 0; i < 60; i++) {
      const next = pickKicker(now);
      expect(next).not.toBe(previous);
      previous = next;
    }
  });
});

describe('the line under "claimed"', () => {
  it('fits its slot, and assumes nothing about the prize', () => {
    for (const line of DAILY_PAID_SUBS) {
      expect(line.length, line).toBeLessThanOrEqual(PAID_SUB_MAX);
      expect(line, line).not.toMatch(/!/);
      // A card day or a gem day: nothing here may tell the player to spend it.
      expect(line, line).not.toMatch(/\bspend\b/i);
    }
  });

  it('never deals the same line twice running', () => {
    let previous = pickPaidSub();
    for (let i = 0; i < 60; i++) {
      const next = pickPaidSub();
      expect(next).not.toBe(previous);
      previous = next;
    }
  });
});

describe('the card-day lead-in and the ready heading', () => {
  // Any card can land on a card day, the Custody-Battle Cub included: the
  // lead-in is fixed, says deck, and wraps no card.
  it('is the plain deck line', () => {
    expect(CARD_DAY_LEAD_IN).toBe('From the deck behind the bar:');
  });

  it('still says which day is waiting', () => {
    for (let day = 1; day <= 7; day++) {
      expect(dayReadyTitle(day)).toContain(`Day ${day}`);
      expect(dayReadyTitle(day).length).toBeLessThanOrEqual(26);
    }
  });
});
