import {
  placePreview, fitPreview, previewSize, rowExtents, captionHeight, CENTRE_CLEAR, SIDE_MIN_ZOOM, COMFORT_ZOOM, CAPTION_H,
} from './previewPlacement';
import { ALL_CARDS } from '@/stores/gameStore';
import { abilityRules } from '@/lib/abilities';

// Felts as fitField measured them in the running app (Chromium), with the
// rows' zoom at each size. A row is 96px a slot plus 12px between, at zoom.
const FELTS = {
  '320x640': { width: 290, height: 301, pad: { top: 12, right: 8, bottom: 12, left: 8 }, gap: 12, centre: { top: 118, bottom: 184 }, zoom: 0.64 },
  // The shortest phones: an iPhone SE with Safari's toolbars out, and a 390
  // wide one in the same browser (e2e/responsive.spec.js's sizes).
  '375x553': { width: 345, height: 327, pad: { top: 12, right: 8, bottom: 12, left: 8 }, gap: 12, centre: { top: 130, bottom: 196 }, zoom: 0.73 },
  '390x664': { width: 360, height: 325, pad: { top: 12, right: 8, bottom: 12, left: 8 }, gap: 12, centre: { top: 130, bottom: 196 }, zoom: 0.73 },
  // The same phones with a touch screen: there the board does not hold the
  // desktop 640px minimum, so the felt is far shorter and the rows sit at
  // 0.45. (Measured with hasTouch and isMobile; the centre band is 66px, in
  // the middle.) The shorter touch viewports (320x480, 360x500) are left out: their
  // felt is too short for any centre band to be modelled from here, and
  // e2e/board.spec.js is where a real board of that size is held.
  'touch 375x553': { width: 345, height: 240, pad: { top: 12, right: 8, bottom: 12, left: 8 }, gap: 12, centre: { top: 87, bottom: 153 }, zoom: 0.45 },
  'touch 320x568': { width: 290, height: 255, pad: { top: 12, right: 8, bottom: 12, left: 8 }, gap: 12, centre: { top: 95, bottom: 161 }, zoom: 0.48 },
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

// ---- The caption's words: what the preview reserves room for ----

// A card's caption as the board builds it (GameBoard's previewCaption).
const captionOf = (card, keys = false) => ({
  rules: card.ability && card.ability !== 'none' ? abilityRules(card.ability) : '',
  flavor: card.description ?? '',
  keys,
});
// What placePreview kept of it, as the caption the preview is drawn with.
const keptCaption = (caption, kept) => {
  const words = {
    rules: kept.rules ? caption.rules : '', flavor: kept.flavor ? caption.flavor : '', keys: kept.keys && caption.keys,
  };
  return words.rules || words.flavor || words.keys ? words : false;
};

describe('captionHeight', () => {
  it('is nothing for no caption, and the old fixed height for a bare `true`', () => {
    expect(captionHeight(false, 160)).toBe(0);
    expect(captionHeight(null, 160)).toBe(0);
    expect(captionHeight(true, 160)).toBe(CAPTION_H);
    expect(captionHeight(true, 140)).toBe(CAPTION_H);
  });

  it('grows with each block it holds, and a narrower caption is never shorter than a wider one', () => {
    const base = { rules: 'Gains +1 attack each time it survives a hit, up to +3', flavor: 'Lights the next one off your burning deck.', keys: false };
    const heights = [
      captionHeight({ ...base, flavor: '', keys: false }, 160),
      captionHeight({ ...base, keys: false }, 160),
      captionHeight({ ...base, keys: true }, 160),
    ];
    expect(heights[0]).toBeLessThan(heights[1]);
    expect(heights[1]).toBeLessThan(heights[2]);
    for (const words of [base, { ...base, keys: true }, { rules: '', flavor: base.flavor, keys: false }]) {
      expect(captionHeight(words, 140)).toBeGreaterThanOrEqual(captionHeight(words, 160));
      expect(captionHeight(words, 160)).toBeGreaterThanOrEqual(captionHeight(words, 192));
    }
  });

  it('counts an empty rules or flavor string as no block at all', () => {
    expect(captionHeight({ rules: '', flavor: '', keys: false }, 160)).toBe(16);
    expect(captionHeight({ rules: '', flavor: 'Fights dirty. Tips worse.', keys: false }, 160))
      .toBeLessThan(captionHeight({ rules: 'Enemies must attack this card first', flavor: 'Fights dirty. Tips worse.', keys: false }, 160));
  });

  // The model is a guess at how text wraps, so it is held to the real thing:
  // these are the heights the page gave the caption's own markup (Chromium,
  // the widest fallback font on the machines it ran on), measured by loading the
  // cards' own words into it at the three widths a caption is drawn at. A model
  // under any of them would reserve too little and let the caption run out of
  // its box; one far over wastes the card's room.
  // Frozen with the words they were measured with, so a punched-up flavor line
  // in the catalog (the copy deck rewrites them) cannot drift the heights and
  // the words apart; e2e/board.spec.js holds the live cards to the real page.
  const WORDS = {
    'Sticky Mickey': { rules: "While it's on the field, its allies can't be targeted", flavor: "Nobody asks why he's sticky. He's not going anywhere, and neither is whoever's behind him." },
    'Two-Beer Tina': { rules: 'Gains +1 attack each time it survives a hit, up to +3', flavor: "Two beers in and she's everyone's problem. Three beers in and she's unstoppable." },
    'Bar-Top Baptism': { rules: '', flavor: 'Fully submerged in the good stuff. Born again, smells worse.' },
    'Blackout Bjorn': { rules: 'Gains +1 attack each time it survives a hit, up to +3', flavor: 'Remembers nothing. Regrets everything. Hits like a truck.' },
    'Shitstarter Ted': { rules: '', flavor: 'Every bar fight in this town starts with Ted.' },
    'Mama Mauls': { rules: 'Enemies must attack this card first', flavor: 'The apron stays on. The rolling pin does not.' },
    'Minibar Raid': { rules: '', flavor: 'Tiny bottles. Tiny crimes. Tiny recovery.' },
  };
  const MEASURED = [
    ['Sticky Mickey', 140, false, 172], ['Sticky Mickey', 140, true, 221], ['Sticky Mickey', 160, false, 172],
    ['Sticky Mickey', 160, true, 221], ['Sticky Mickey', 192, false, 140.5], ['Sticky Mickey', 192, true, 169.5],
    ['Two-Beer Tina', 140, false, 188.5], ['Two-Beer Tina', 140, true, 237.5], ['Two-Beer Tina', 160, false, 157],
    ['Two-Beer Tina', 192, true, 169.5],
    ['Bar-Top Baptism', 140, false, 76], ['Bar-Top Baptism', 160, true, 110], ['Bar-Top Baptism', 192, false, 61],
    ['Blackout Bjorn', 140, false, 173.5], ['Blackout Bjorn', 140, true, 222.5], ['Blackout Bjorn', 160, false, 142],
    ['Blackout Bjorn', 192, true, 139.5],
    ['Shitstarter Ted', 140, false, 61], ['Shitstarter Ted', 140, true, 110], ['Shitstarter Ted', 160, true, 95],
    ['Shitstarter Ted', 192, false, 46], ['Shitstarter Ted', 192, true, 75],
    ['Mama Mauls', 140, false, 127], ['Mama Mauls', 160, true, 159.5], ['Mama Mauls', 192, false, 110.5],
    ['Minibar Raid', 140, true, 110], ['Minibar Raid', 192, false, 46],
  ];
  it.each(MEASURED)('reserves at least what %s\'s caption takes at %ipx (keys %s: measured %f)', (name, width, keys, real) => {
    const modelled = captionHeight({ ...WORDS[name], keys }, width);
    expect(modelled).toBeGreaterThanOrEqual(real);
    expect(modelled - real, 'the model reserves far more than the page uses').toBeLessThanOrEqual(50);
  });
});

// Every card, as the board would caption it, on every felt the app has been
// measured at: the preview stays clear of the row it was opened from, inside
// its box, and never disappears. The flavor line is shown wherever the card can
// be drawn comfortably with it, and a card that gives it up gives up nothing else
// that it could keep.
describe('placePreview with every card\'s own caption', () => {
  const felts = Object.entries(FELTS);

  it.each(felts)('at %s keeps clear of the row it was opened from, and inside its box', (name, felt) => {
    const midX = (felt.pad.left + felt.width - felt.pad.right) / 2;
    for (const slots of [1, 2, 3, 4]) {
      const geom = geomFor(felt, slots);
      const rows = rowExtents(geom);
      for (const card of ALL_CARDS) {
        for (const keys of [false, true]) {
          const caption = captionOf(card, keys);
          for (const anchor of ['opponent', 'player', 'hand']) {
            const p = placePreview(geom, anchor, caption);
            const where = `${card.name}, ${slots} slots, keys ${keys}, ${anchor}`;
            expect(p.zoom, `${where}: the preview is gone`).toBeGreaterThan(0);
            const shown = drawn(p, keptCaption(caption, p.kept));
            expect(shown.w, `${where}: wider than its box`).toBeLessThanOrEqual(p.w + 0.5);
            expect(shown.h, `${where}: taller than its box`).toBeLessThanOrEqual(p.h + 0.5);
            if (anchor === 'hand') continue;
            const row = { x: midX - geom.rowW / 2, w: geom.rowW, y: rows[anchor].top, h: rows[anchor].bottom - rows[anchor].top };
            expect(overlaps(shown, row), `${where}: covers the ${anchor} row`).toBe(false);
          }
        }
      }
    }
  });

  it.each(felts)('at %s never gives up the rules for the flavor, and keeps the flavor wherever the card is comfortable with it', (name, felt) => {
    for (const slots of [1, 3]) {
      const geom = geomFor(felt, slots);
      for (const card of ALL_CARDS) {
        const caption = captionOf(card, false);
        for (const anchor of ['opponent', 'player', 'hand']) {
          const p = placePreview(geom, anchor, caption);
          const where = `${card.name}, ${slots} slots, ${anchor}`;
          // The rules are the game; they stay (no keys here, so nothing else is before them).
          if (caption.rules) expect(p.kept.rules, `${where}: the rules were dropped`).toBe(true);
          // A card that dropped its flavor could not have had it at a comfortable size.
          if (!p.kept.flavor) {
            const without = placePreview(geom, anchor, { ...caption, flavor: '' });
            expect(without.zoom, `${where}: the flavor was dropped for nothing`).toBeGreaterThan(p.zoom - 0.001);
          } else {
            expect(p.zoom, `${where}: the flavor is kept at a size too small to read`).toBeGreaterThanOrEqual(0.99);
          }
        }
      }
    }
  });

  // "The best jokes, shown": from a 390x844 phone up, on a card of any size
  // (the flavor line is one of the three longest on the table, never the
  // reason a card cannot be read), every card keeps its flavor in the preview
  // opened with a mouse or a finger.
  it.each(['390x844', '768x1024', '1280x800'])('at %s every card keeps its flavor line in the preview a mouse or a finger opens', (name) => {
    for (const slots of [1, 2, 3]) {
      const geom = geomFor(FELTS[name], slots);
      for (const card of ALL_CARDS) {
        for (const anchor of ['opponent', 'player', 'hand']) {
          expect(placePreview(geom, anchor, captionOf(card, false)).kept.flavor, `${card.name}, ${slots} slots, ${anchor}`).toBe(true);
        }
      }
    }
  });

  it('says what it kept: a bare caption is its rules, and nothing is kept of none', () => {
    const geom = geomFor(FELTS['390x844'], 3);
    expect(placePreview(geom, 'player', true).kept).toEqual({ rules: true, flavor: false, keys: false });
    expect(placePreview(geom, 'player', false).kept).toEqual({ rules: false, flavor: false, keys: false });
    const sticky = ALL_CARDS.find((c) => c.name === 'Sticky Mickey');
    expect(placePreview(geom, 'player', captionOf(sticky)).kept).toEqual({ rules: true, flavor: true, keys: false });
  });

  // Too small a felt for the whole caption: the flavor goes first, then the keys
  // (Escape closes the preview whether or not it says so). The rules go only
  // when nothing that keeps them leaves the card any room, and the preview is
  // never lost to a caption.
  it('drops the flavor first, then the keys, keeps the rules, and never loses the preview to its caption', () => {
    const sticky = ALL_CARDS.find((c) => c.name === 'Sticky Mickey');
    const full = captionOf(sticky, true);
    const small = placePreview(geomFor(FELTS['375x553'], 3), 'player', full);
    expect(small.kept, 'a short phone gives up the flavor, and nothing else it can keep').toEqual({ rules: true, flavor: false, keys: true });
    expect(small.zoom).toBeGreaterThan(0);
    // The same order wherever the room runs out, on every card and every felt:
    // the flavor goes before the keys, and the keys before the rules.
    for (const felt of Object.values(FELTS)) {
      for (const card of ALL_CARDS) {
        for (const anchor of ['opponent', 'player', 'hand']) {
          const { kept } = placePreview(geomFor(felt, 3), anchor, captionOf(card, true));
          if (kept.flavor) expect(kept.keys, `${card.name}: the flavor outlived the keys`).toBe(true);
          if (kept.keys) expect(kept.rules || !captionOf(card).rules, `${card.name}: the keys outlived the rules`).toBe(true);
        }
      }
    }
    // A felt with no room for any caption at all still draws the card.
    const tiny = placePreview(geomFor({ ...FELTS['320x640'], height: 150, centre: { top: 50, bottom: 100 } }, 3), 'player', full);
    expect(tiny.zoom).toBeGreaterThan(0);
    expect(tiny.kept.rules, 'the rules go last, when the card would otherwise have no room').toBe(false);
    expect(COMFORT_ZOOM).toBe(SIDE_MIN_ZOOM);
  });
});
