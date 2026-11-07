import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  WARDROBE, WARDROBE_LABEL_MAX, DEFAULT_CARD_BACK, DEFAULT_BOARD,
  wardrobeItem, wardrobeLong, ownsWardrobe, quoteWardrobe, cardBackId, boardId,
} from './wardrobe';

const fresh = { coins: 500, gems: 10, unlockedCosmetics: [] };

describe('wardrobe catalog', () => {
  it('sells backs and boards, with a free one of each to start in', () => {
    expect(WARDROBE.filter((item) => item.slot === 'back').length).toBeGreaterThanOrEqual(3);
    expect(WARDROBE.filter((item) => item.slot === 'board').length).toBeGreaterThanOrEqual(3);
    expect(ownsWardrobe([], wardrobeItem(DEFAULT_CARD_BACK))).toBe(true);
    expect(ownsWardrobe([], wardrobeItem(DEFAULT_BOARD))).toBe(true);
    expect(wardrobeItem(DEFAULT_CARD_BACK).price).toBe(0);
    expect(wardrobeItem(DEFAULT_BOARD).price).toBe(0);
  });

  it('keeps ids unique, prices honest, and the words inside their slot', () => {
    const ids = WARDROBE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of WARDROBE) {
      expect(item.label.length, item.label).toBeLessThanOrEqual(WARDROBE_LABEL_MAX);
      expect(item.label, item.label).not.toMatch(/!/);
      expect(item.blurb, item.blurb).not.toMatch(/!/);
      expect(item.blurb.length, item.blurb).toBeGreaterThan(0);
      expect(['coins', 'gems']).toContain(item.currency);
      expect(item.price, item.id).toBeGreaterThanOrEqual(0);
      if (item.price === 0) expect(item.currency).toBe('coins');
      if (item.currency === 'gems') expect(item.price, item.id).toBeGreaterThan(0);
      const long = wardrobeLong(item);
      expect(long.startsWith(item.label), long).toBe(true);
      const kind = { back: 'card back', board: 'board', finish: 'finish', avatar: 'frame', line: 'line' }[item.slot];
      expect(long.endsWith(kind), long).toBe(true);
      expect(item.swatch, item.id).toMatch(/^#[0-9a-f]{6}$/);
    }
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    for (const item of WARDROBE) {
      expect(css, `${item.id} swatch`).toContain(item.swatch);
    }
  });

  it('repairs an unknown equipped id back to the house look', () => {
    expect(cardBackId('velvet-rope')).toBe('velvet-rope');
    expect(cardBackId('Gold Border')).toBe(DEFAULT_CARD_BACK);
    expect(cardBackId(undefined)).toBe(DEFAULT_CARD_BACK);
    expect(boardId('red-room')).toBe('red-room');
    expect(boardId('house-back')).toBe(DEFAULT_BOARD);
  });
});

describe('quoteWardrobe', () => {
  it('spends coins, records the id, and puts the look on', () => {
    const quote = quoteWardrobe(fresh, 'velvet-rope');
    expect(quote).toMatchObject({
      ok: true,
      reason: 'bought',
      patch: {
        coins: 100,
        unlockedCosmetics: ['velvet-rope'],
        equippedCardBack: 'velvet-rope',
      },
    });
    expect(quote.patch.gems).toBeUndefined();
  });

  it('spends gems without touching coins', () => {
    const quote = quoteWardrobe({ ...fresh, gems: 40 }, 'brass-knuckles');
    expect(quote.ok).toBe(true);
    expect(quote.patch).toMatchObject({ gems: 10, equippedCardBack: 'brass-knuckles' });
    expect(quote.patch.coins).toBeUndefined();
  });

  it('refuses a purse that cannot cover it, and does not equip a free look twice into the ledger', () => {
    expect(quoteWardrobe({ ...fresh, coins: 10 }, 'velvet-rope')).toMatchObject({ ok: false, reason: 'short' });
    expect(quoteWardrobe({ ...fresh, gems: 0 }, 'cold-open')).toMatchObject({ ok: false, reason: 'short' });
    const house = quoteWardrobe(fresh, 'house-back');
    expect(house.reason).toBe('owned');
    expect(house.patch).toEqual({ equippedCardBack: 'house-back' });
    expect(house.patch.unlockedCosmetics).toBeUndefined();
  });

  it('will not sell the same look twice', () => {
    const again = quoteWardrobe({ ...fresh, unlockedCosmetics: ['red-room'] }, 'red-room');
    expect(again.reason).toBe('owned');
    expect(again.patch).toEqual({ equippedBoard: 'red-room' });
  });

  it('does not invent a look', () => {
    expect(quoteWardrobe(fresh, 'Gold Border')).toEqual({ ok: false, reason: 'unknown' });
  });
});
