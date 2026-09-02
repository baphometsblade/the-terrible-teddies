import { buildVisibleOrder, staggerDelay } from './collectionOrder';

// A catalog whose rarities interleave, so a rarity filter's matches are
// scattered rather than contiguous — the shape that broke the stagger.
const CATALOG = Array.from({ length: 60 }, (_, i) => ({
  id: `c${i}`,
  rarity: ['common', 'rare', 'epic'][i % 3],
}));

const byRarity = (rarity) => (card) => card.rarity === rarity;

describe('buildVisibleOrder', () => {
  it('numbers matching cards consecutively from zero, ignoring source position', () => {
    const order = buildVisibleOrder(CATALOG, byRarity('epic'));
    // The first epic sits at catalog index 2, but it is the FIRST tile the
    // player sees, so it must animate first.
    expect(order.get('c2')).toBe(0);
    expect(order.get('c5')).toBe(1);
    expect(order.get('c8')).toBe(2);
  });

  it('omits non-matching cards, so has() is the visibility test', () => {
    const order = buildVisibleOrder(CATALOG, byRarity('epic'));
    expect(order.has('c2')).toBe(true);
    expect(order.has('c0')).toBe(false);
  });

  it('size is the visible count', () => {
    expect(buildVisibleOrder(CATALOG, byRarity('epic')).size).toBe(20);
    expect(buildVisibleOrder(CATALOG, () => false).size).toBe(0);
    expect(buildVisibleOrder(CATALOG, () => true).size).toBe(CATALOG.length);
  });
});

describe('staggerDelay', () => {
  it('caps so a long list does not push the last tile seconds out', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(10)).toBeCloseTo(0.2);
    expect(staggerDelay(500)).toBe(0.5);
  });

  it('treats a missing ordinal (a hidden tile) as zero rather than NaN', () => {
    expect(staggerDelay(undefined)).toBe(0);
  });

  // The regression itself: keying off catalog position instead of visible
  // position saturated the cap for EVERY visible tile, so nothing staggered —
  // the grid sat blank and then popped in all at once.
  it('keeps a filtered view under the cap where raw indices would saturate it', () => {
    const matches = byRarity('epic');
    const order = buildVisibleOrder(CATALOG, matches);
    const visible = CATALOG.filter(matches);

    // Catalog positions run to 59 here, so most epics land past the 25-tile
    // point where the cap bites and their delays collide at 0.5s — the tail of
    // the grid stops staggering and appears in one lump.
    const rawIndexDelays = visible.map((c) => staggerDelay(CATALOG.indexOf(c)));
    expect(rawIndexDelays.filter((d) => d === 0.5).length).toBeGreaterThan(visible.length / 2);
    expect(new Set(rawIndexDelays).size).toBeLessThan(visible.length);

    // Visible ordinals stay inside the cap, so every tile gets its own step.
    const delays = visible.map((c) => staggerDelay(order.get(c.id)));
    expect(new Set(delays).size).toBe(visible.length);
    expect(Math.max(...delays)).toBeLessThan(0.5);
  });
});
