import { describe, it, expect } from 'vitest';
import { SHOP_ITEMS } from './gameStore';

// The store tiles' blurbs are slotted into fixed tiles: the deck's budget for
// each line (collection-store.json maxChars) is held here from the live table.
describe('SHOP_ITEMS blurbs fit their slots', () => {
  it('description <= 42 characters and short <= 36 for the packs and bags', () => {
    for (const item of SHOP_ITEMS) {
      if (!['pack', 'premium', 'legendary', 'coins'].includes(item.type)) continue;
      expect(item.description.length, item.id).toBeLessThanOrEqual(42);
      if (item.short) expect(item.short.length, item.id).toBeLessThanOrEqual(36);
    }
  });
});
