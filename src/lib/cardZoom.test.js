import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { CARD_ZOOM_QUERY, gridArtVariant } from './cardZoom';

// The stylesheet decides when the card grids are drawn larger; the components
// decide, from CARD_ZOOM_QUERY, when to ask for sharper art. Read from
// index.css itself rather than restated, so moving the breakpoint in one place
// without the other fails here: cards drawn larger on upscaled thumbnails, or
// hand-size cards fetching the 768px originals.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const zoomQueries = [...css.matchAll(/@media\s*\(min-width:\s*(\d+)px\)\s*\{\s*\.card-zoom\s*\{\s*zoom:\s*([\d.]+)/g)]
  .map((m) => ({ minWidth: Number(m[1]), zoom: Number(m[2]) }));

describe('card grid zoom', () => {
  it('finds the .card-zoom rules in index.css', () => {
    // Without this the checks below could pass vacuously on a renamed class.
    expect(zoomQueries.length).toBeGreaterThan(0);
  });

  it('asks for responsive art from exactly the width the grids start to zoom', () => {
    const first = Math.min(...zoomQueries.map((q) => q.minWidth));
    expect(CARD_ZOOM_QUERY).toBe(`(min-width: ${first}px)`);
  });

  it('only ever zooms the grids up, never shrinks a card below hand size', () => {
    for (const q of zoomQueries) expect(q.zoom).toBeGreaterThan(1);
  });

  it('keeps the thumbnail for hand-size cards and asks responsively for zoomed ones', () => {
    expect(gridArtVariant(false)).toBe('thumb');
    expect(gridArtVariant(true)).toBe('responsive');
  });
});
