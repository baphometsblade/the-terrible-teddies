import { describe, it, expect } from 'vitest';
import { revealOrder, waveRanges, tableLayout, CARD_W, ZOOM_FLOOR, ZOOM_MAX } from './packReveal';
import { RARITY_ORDER } from './rarity';

const card = (id, rarity, extra = {}) => ({ id, rarity, ...extra });

describe('revealOrder', () => {
  it('turns the best card last, without reordering the store result', () => {
    // A Legendary pack as the store returns it: the guaranteed card in slot 0.
    const pulled = [card(20, 'legendary'), card(1, 'common'), card(16, 'epic'), card(6, 'uncommon'), card(2, 'common')];
    const shown = revealOrder(pulled);
    expect(shown.map((c) => c.rarity)).toEqual(['common', 'common', 'uncommon', 'epic', 'legendary']);
    expect(pulled[0].rarity).toBe('legendary');
  });

  it('is stable, so a duplicate keeps isNew on its first copy', () => {
    const pulled = [card(5, 'common', { isNew: true }), card(13, 'rare'), card(5, 'common', { isNew: false })];
    const shown = revealOrder(pulled);
    expect(shown.filter((c) => c.id === 5).map((c) => c.isNew)).toEqual([true, false]);
  });
});

describe('waveRanges', () => {
  it('deals at most five cards at a time', () => {
    expect(waveRanges(5)).toEqual([[0, 5]]);
    expect(waveRanges(10)).toEqual([[0, 5], [5, 10]]);
    expect(waveRanges(9)).toEqual([[0, 5], [5, 9]]);
  });
});

describe('tableLayout', () => {
  // The field widths the table measures at the viewports the audit used: the
  // stage's content box inside the dialog's nested paddings.
  it('splits five cards 3 + 2 on phones, zoomed to fit a 320px screen', () => {
    const at320 = tableLayout(5, 270);
    expect(at320.rows).toEqual([3, 2]);
    expect(at320.zoom).toBeCloseTo(270 / (3 * CARD_W + 2 * at320.gap), 2);
    expect(at320.zoom).toBeGreaterThan(0.85);
    expect(tableLayout(5, 316)).toMatchObject({ rows: [3, 2], zoom: 1 });
  });

  it('keeps five in one row where they fit, zooming up on a wide table', () => {
    expect(tableLayout(5, 608).rows).toEqual([5]);
    expect(tableLayout(5, 608).zoom).toBeGreaterThan(1);
    expect(tableLayout(5, 2000).zoom).toBe(ZOOM_MAX);
  });

  it('never leaves a card alone on a row, and never draws below the floor', () => {
    for (let count = 1; count <= 5; count++) {
      for (let width = 200; width <= 1100; width += 7) {
        const { rows, zoom } = tableLayout(count, width);
        expect(rows.reduce((a, b) => a + b, 0)).toBe(count);
        if (count > 1) expect(rows.every((n) => n > 1), `${count} cards at ${width}px → ${rows}`).toBe(true);
        expect(zoom).toBeGreaterThanOrEqual(ZOOM_FLOOR);
        expect(rows.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('fits the widest row inside the field wherever the floor allows', () => {
    for (let width = 240; width <= 1100; width += 11) {
      const { rows, gap, zoom } = tableLayout(5, width);
      const drawn = (rows[0] * CARD_W + (rows[0] - 1) * gap) * zoom;
      expect(drawn, `at ${width}px`).toBeLessThanOrEqual(width + 0.5);
    }
  });

  it('knows nothing until the field is measured', () => {
    expect(tableLayout(5, 0)).toMatchObject({ rows: [5], zoom: 1 });
  });
});

// The order every reveal surface shares.
it('RARITY_ORDER runs commonest to best', () => {
  expect(RARITY_ORDER[0]).toBe('common');
  expect(RARITY_ORDER[RARITY_ORDER.length - 1]).toBe('legendary');
});
