import {
  placePreview, fitPreview, previewSize, rowExtents, CENTRE_CLEAR, SIDE_MIN_ZOOM,
} from './previewPlacement';

// Felts as fitField measured them in the running app (Chromium), with the
// rows' zoom at each size. A row is 96px a slot plus 12px between, at zoom.
const FELTS = {
  '320x640': { width: 290, height: 301, pad: { top: 12, right: 8, bottom: 12, left: 8 }, gap: 12, centre: { top: 118, bottom: 184 }, zoom: 0.64 },
  '390x844': { width: 360, height: 446, pad: { top: 12, right: 8, bottom: 12, left: 8 }, gap: 12, centre: { top: 190, bottom: 256 }, zoom: 1 },
  '768x1024': { width: 482, height: 658, pad: { top: 16, right: 16, bottom: 16, left: 16 }, gap: 12, centre: { top: 294, bottom: 364 }, zoom: 1 },
  '1024x768': { width: 722, height: 402, pad: { top: 16, right: 16, bottom: 16, left: 16 }, gap: 12, centre: { top: 166, bottom: 236 }, zoom: 0.95 },
  '1280x800': { width: 978, height: 434, pad: { top: 16, right: 16, bottom: 16, left: 16 }, gap: 12, centre: { top: 186, bottom: 248 }, zoom: 1 },
};
const geomFor = (felt, slots) => ({
  ...felt, rowH: 144 * felt.zoom, rowW: (slots * 96 + (slots - 1) * 12) * felt.zoom,
});
// The drawn preview: its size, centred in the box placePreview returned.
const drawn = (p, caption) => {
  const size = previewSize(p.zoom, p.layout, caption);
  return { x: p.x + (p.w - size.w) / 2, y: p.y + (p.h - size.h) / 2, ...size };
};
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const cases = [];
for (const [name, felt] of Object.entries(FELTS)) {
  for (const slots of [1, 2, 3, 4]) {
    for (const caption of [false, true]) cases.push([name, felt, slots, caption]);
  }
}

describe('placePreview', () => {
  it.each(cases)('at %s with %i slots (caption %s) never covers the row it was opened from', (name, felt, slots, caption) => {
    const geom = geomFor(felt, slots);
    const rows = rowExtents(geom);
    const midX = (felt.pad.left + felt.width - felt.pad.right) / 2;
    for (const anchor of ['opponent', 'player']) {
      const p = placePreview(geom, anchor, caption);
      const shown = drawn(p, caption);
      const row = { x: midX - geom.rowW / 2, w: geom.rowW, y: rows[anchor].top, h: rows[anchor].bottom - rows[anchor].top };
      expect(overlaps(shown, row), `${anchor} row covered by ${p.place}`).toBe(false);
      // And it fits the box it was given (half a pixel for rounding).
      expect(shown.w, p.place).toBeLessThanOrEqual(p.w + 0.5);
      expect(shown.h, p.place).toBeLessThanOrEqual(p.h + 0.5);
    }
  });

  it.each(cases)('at %s with %i slots (caption %s) leaves the centre line\'s plaque and prompt alone when beside the rows', (name, felt, slots, caption) => {
    const geom = geomFor(felt, slots);
    const midX = (felt.pad.left + felt.width - felt.pad.right) / 2;
    for (const anchor of ['opponent', 'player', 'hand']) {
      const p = placePreview(geom, anchor, caption);
      if (!p.place.startsWith('side')) continue;
      const shown = drawn(p, caption);
      const plaque = { x: midX - CENTRE_CLEAR, w: 2 * CENTRE_CLEAR, y: felt.centre.top, h: felt.centre.bottom - felt.centre.top };
      expect(overlaps(shown, plaque), p.place).toBe(false);
      expect(p.zoom).toBeGreaterThanOrEqual(SIDE_MIN_ZOOM);
    }
  });

  // The point of the preview is reading a card the table draws small.
  it('draws a table card well above its table size on a phone, beside the caption', () => {
    const small = placePreview(geomFor(FELTS['320x640'], 3), 'player', true);
    expect(small.place).toBe('top');
    expect(small.layout).toBe('row');
    expect(small.zoom).toBeGreaterThanOrEqual(1.15); // the row is at 0.64
    const phone = placePreview(geomFor(FELTS['390x844'], 3), 'opponent', true);
    expect(phone.place).toBe('bottom');
    expect(phone.zoom).toBeGreaterThanOrEqual(1.6);
  });

  it('puts a hand card over the whole felt, and a wide table beside the rows at full size', () => {
    expect(placePreview(geomFor(FELTS['390x844'], 3), 'hand', true)).toMatchObject({ place: 'full', zoom: 2 });
    for (const anchor of ['opponent', 'player', 'hand']) {
      expect(placePreview(geomFor(FELTS['1280x800'], 3), anchor, true)).toMatchObject({ place: 'side', zoom: 2 });
    }
  });

  // At 768 the full-height side box ran over the turn plaque ("Turn 1 · Y…").
  it('on a tablet keeps beside the rows only above or below the centre line, else takes the far half', () => {
    const one = placePreview(geomFor(FELTS['768x1024'], 1), 'player', false);
    expect(['sideTop', 'sideBottom']).toContain(one.place);
    const three = placePreview(geomFor(FELTS['768x1024'], 3), 'player', true);
    expect(three).toMatchObject({ place: 'top', zoom: 2 });
  });
});

describe('fitPreview', () => {
  it('sets the caption beside the card in a short, wide box, and under it in a tall one', () => {
    expect(fitPreview(274, 184, true).layout).toBe('row');
    expect(fitPreview(344, 422, true).layout).toBe('column');
    expect(fitPreview(274, 184, false)).toEqual({ zoom: 1.27, layout: 'column' });
  });

  it('gives no size to a box with no room', () => {
    expect(fitPreview(0, 300, true).zoom).toBe(0);
    expect(fitPreview(-20, 300, false).zoom).toBe(0);
  });
});
