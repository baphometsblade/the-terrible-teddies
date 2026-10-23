import { RARITY_ORDER } from '@/lib/rarity';

// The pure half of the pack reveal (CardPackOpening): what order the cards
// turn in, how a pack is dealt in waves, and how a wave sits on the table.

/**
 * The order the cards are shown and turned in: commonest first, the best
 * card last. Display only — the store's own order (the guaranteed card in
 * slot 0) is untouched. Stable, so a duplicate keeps its copies in store
 * order and `isNew` stays on the first of them.
 */
export const revealOrder = (cards) => cards
  .map((card, i) => [card, i])
  .sort((a, b) => RARITY_ORDER.indexOf(a[0].rarity) - RARITY_ORDER.indexOf(b[0].rarity) || a[1] - b[1])
  .map(([card]) => card);

// At most this many cards on the table at once. A ten-card Legendary pack is
// dealt as two waves of five, so every card turns where it can be seen: laid
// out all at once it ran 3 + 3 + 3 + 1 at 390px, and the last three flipped
// below the fold.
export const WAVE_SIZE = 5;

/** [start, end) index ranges, one per wave. */
export const waveRanges = (count, size = WAVE_SIZE) => {
  const out = [];
  for (let start = 0; start < count; start += size) out.push([start, Math.min(count, start + size)]);
  return out;
};

export const CARD_W = 96;
// Five cards at the roomy gap, plus slack: the width from which a full row is
// zoomed UP (to at most ZOOM_MAX), as the table always did on big screens.
export const ROW_CAP = 5 * CARD_W + 4 * 16 + 8;
export const ZOOM_MAX = 1.4;
// The smallest a card may be drawn. At 0.78 its 6px type is ~4.7px; the
// narrow-phone gap and paddings keep a 320px screen near 0.89 instead.
export const ZOOM_FLOOR = 0.78;

/** The horizontal gap between cards for a field this wide. */
export const gapFor = (width) => (width >= ROW_CAP ? 16 : width < 300 ? 8 : 12);

const rowWidth = (n, gap) => n * CARD_W + (n - 1) * gap;

/**
 * How one wave of `count` cards sits on a field `width` px wide: explicit
 * rows (never a row holding a single card) and the CSS zoom that fits the
 * widest of them.
 *
 * One row if the wave fits at zoom 1 (or is three cards or fewer — split,
 * those would leave one alone); otherwise two balanced rows, 5 → 3 + 2.
 * Where even three do not fit, the zoom drops below 1, to ZOOM_FLOOR at most.
 * A single row zooms up on a wide field, as far as ZOOM_MAX.
 */
export const tableLayout = (count, width) => {
  const gap = gapFor(width);
  if (!width || count === 0) return { rows: count ? [count] : [], gap, zoom: 1 };
  const fit = Math.max(1, Math.floor((width + gap) / (CARD_W + gap)));
  const rows = count <= fit || count <= 3 ? [count] : [Math.ceil(count / 2), Math.floor(count / 2)];
  const widest = rows[0];
  const need = rowWidth(widest, gap);
  let zoom;
  if (rows.length === 1 && width >= ROW_CAP) zoom = Math.min(ZOOM_MAX, width / ROW_CAP);
  else zoom = Math.min(1, width / need);
  return { rows, gap, zoom: Math.max(ZOOM_FLOOR, Number(zoom.toFixed(3))) };
};
