// Where the enlarged card (GameBoard's CardPreview) sits on the felt, and how
// big it is drawn.
//
// The rule that matters: it never covers the row of the card it is about —
// the card a keyboard player has focused, the card under the mouse, the card
// under the finger. It used to sit over the middle of the felt at every phone
// width, so tabbing to "Select Coupon Carl to attack" put a 2x card on top of
// Coupon Carl (WCAG 2.4.11) and most of both rows.
//
// Every figure is CSS px in the felt's own box (origin at its top-left
// corner), at layout size: the felt itself is not zoomed, its rows are.

export const CARD_W = 96;
export const CARD_H = 144;
export const MAX_PREVIEW_ZOOM = 2;
// A card drawn this big (two fifths bigger than in the hand) reads well enough
// that its caption need not give way for it: the size the rows need to be
// worth a place beside them (SIDE_MIN_ZOOM, below).
export const COMFORT_ZOOM = 1.4;
// Beside the rows only from this size; smaller, the card reads better over
// the half of the table it does not hide.
export const SIDE_MIN_ZOOM = 1.4;
// The caption (the ability's rules, the card's flavor line, the keyboard's
// keys): under the card, at least CAPTION_W wide; beside it, CAPTION_ROW_W wide,
// where it may run a line longer since it has the card's height to fill.
export const CAPTION_W = 160;
export const CAPTION_ROW_W = 140;
// What a caption was assumed to be tall before it carried words of its own: the
// rules of the longest ability, in four lines. A caption given as `true` still
// is this tall.
export const CAPTION_H = 96;
const GAP = 8;
// The centre line's turn plaque and targeting prompt are centred on the
// felt, and neither reaches further than this either side of the middle.
export const CENTRE_CLEAR = 140;
// Room between a row's last card and the preview: the target crosshair
// stands 10px proud of a card's corner.
const ROW_CLEAR = 16;

const floor2 = (n) => Math.floor(n * 100) / 100;

// What a caption is tall, from its words. A caption is a panel (px-3 py-2)
// holding up to three blocks, in this order, set apart by a hairline: the
// ability's rules (a label, then the rules at 12px), the card's flavor line
// (11px italic, quoted) and, when a keyboard opened the preview, the keys that
// drive it (11px). The page cannot be asked how many lines a line of text
// takes before the preview is placed, so the lines are counted here, wrapping
// whole words at an average glyph width: wider than a phone's own font, so it
// counts a line too many rather than one too few (previewPlacement.test.js
// checks the model against every card, and e2e/board.spec.js against the
// rendered preview).
const CAPTION_PAD_X = 24;
const CAPTION_PAD_Y = 16;
const RULES_GLYPH = 7.2;
const RULES_HEAD = 19;
const RULES_LINE = 16.5;
const FLAVOR_GLYPH = 6.6;
const FLAVOR_LINE = 15;
const KEYS_LINE = 16;
// The gap between the two rows the key hints wrap onto (gap-y-1).
const KEYS_GAP = 4;
// The hairline between two blocks, with its margin and padding.
const DIVIDER = 13;
// The two key hints ("I next card", "Esc close") fit on one line from here.
const KEYS_ONE_ROW = 150;

// How many lines `text` takes at `perLine` characters a line, whole words.
const lineCount = (text, perLine) => {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > perLine) {
      lines += Math.ceil(word.length / perLine) - (used === 0 ? 1 : 0);
      used = word.length % perLine;
    } else if (used === 0) {
      used = word.length;
    } else if (used + 1 + word.length > perLine) {
      lines += 1;
      used = word.length;
    } else {
      used += 1 + word.length;
    }
  }
  return lines;
};

/**
 * The height of a caption `width` wide. `caption` is false (none), true (the
 * fixed CAPTION_H, for a caller with no words to give) or
 * `{ rules, flavor, keys }`: the ability's rules and the card's flavor line as
 * text ('' for none), and whether the key hints are on.
 */
export function captionHeight(caption, width) {
  if (!caption) return 0;
  if (caption === true) return CAPTION_H;
  const inner = Math.max(40, width - CAPTION_PAD_X);
  let height = CAPTION_PAD_Y;
  let blocks = 0;
  if (caption.rules) {
    height += RULES_HEAD + lineCount(caption.rules, Math.floor(inner / RULES_GLYPH)) * RULES_LINE;
    blocks += 1;
  }
  if (caption.flavor) {
    height += (blocks ? DIVIDER : 0)
      + lineCount(`“${caption.flavor}”`, Math.floor(inner / FLAVOR_GLYPH)) * FLAVOR_LINE;
    blocks += 1;
  }
  if (caption.keys) {
    const rows = inner >= KEYS_ONE_ROW ? 1 : 2;
    height += (blocks ? DIVIDER : 0) + rows * KEYS_LINE + (rows - 1) * KEYS_GAP;
  }
  return Math.ceil(height);
}

// The caption's width when it sits under a card drawn at `zoom`.
const underWidth = (zoom) => Math.max(CAPTION_W, Math.round(CARD_W * zoom));

/**
 * The largest zoom at which the card (and its caption, if any) fits a w x h
 * box: the caption under the card ('column') or beside it ('row'), whichever
 * lets the card be bigger. A short, wide box — half a phone's felt — takes
 * the caption beside the card; under it, the card would barely beat the size
 * it already is on the table. A caption taller than the box cannot sit beside
 * the card at all (it would run out of the box), and under the card it is
 * reckoned at its narrowest, so a tall box is never promised more than it has.
 */
export function fitPreview(w, h, caption) {
  if (!(w > 0 && h > 0)) return { zoom: 0, layout: 'column' };
  const under = caption ? captionHeight(caption, CAPTION_W) : 0;
  const beside = caption ? captionHeight(caption, CAPTION_ROW_W) : 0;
  const column = caption && w < CAPTION_W
    ? 0
    : Math.min(MAX_PREVIEW_ZOOM, (h - (caption ? under + GAP : 0)) / CARD_H, w / CARD_W);
  const row = caption && beside <= h
    ? Math.min(MAX_PREVIEW_ZOOM, h / CARD_H, (w - CAPTION_ROW_W - GAP) / CARD_W)
    : -Infinity;
  return row > column
    ? { zoom: Math.max(0, floor2(row)), layout: 'row' }
    : { zoom: Math.max(0, floor2(column)), layout: 'column' };
}

/**
 * The preview's outer size at a zoom and layout: the card, and the caption
 * under it (as wide as the card, never under CAPTION_W) or beside it.
 */
export function previewSize(zoom, layout, caption) {
  const card = { w: CARD_W * zoom, h: CARD_H * zoom };
  if (!caption) return card;
  return layout === 'row'
    ? { w: card.w + GAP + CAPTION_ROW_W, h: Math.max(card.h, captionHeight(caption, CAPTION_ROW_W)) }
    : { w: Math.max(card.w, CAPTION_W), h: card.h + GAP + captionHeight(caption, underWidth(zoom)) };
}

/**
 * Where the preview goes.
 *
 * `geom` is the felt as GameBoard's fitField measures it: its `width` and
 * `height`, its padding `pad` ({ top, right, bottom, left }), the grid's
 * `gap`, the centre line's `centre` ({ top, bottom }), and a field row's
 * height `rowH` and the widest row's width `rowW`, both at the rows' zoom.
 * The rows are centred in the two equal tracks either side of the centre
 * line, which is how their position follows from these.
 *
 * `anchor` is the row to keep clear: 'opponent' or 'player' for a table
 * card, 'hand' for a hand card (the hand is below the felt, so nothing on
 * the felt needs keeping clear for it).
 *
 * `caption` is what goes with the card (see captionHeight). Where the whole
 * caption would leave the card small, parts of it go: the flavor line first (a
 * joke, and the Collection has it), then the key hints (Escape closes the
 * preview whether or not it says so), until what is left lets the card be drawn
 * comfortably (COMFORT_ZOOM or more) or no more than a quarter of a unit
 * smaller than it could be. The rules go only when no caption that keeps them
 * leaves the card any room at all: a caption too tall for a small felt would
 * otherwise hide the preview altogether.
 *
 * Beside the rows wins where there is room for it at SIDE_MIN_ZOOM: there it
 * covers no card at all. The beside-the-rows boxes are the two halves above
 * and below the centre line, and the full height kept clear of the centre
 * line's plaque and prompt. Failing that, the half of the felt away from the
 * anchor's row; for a hand card, the whole felt.
 *
 * Returns { place, x, y, w, h, zoom, layout, kept }: the box to centre the
 * preview in, how to draw it there, and which parts of the caption it kept,
 * { rules, flavor, keys }, each true only if it was given and fits.
 */
export function placePreview(geom, anchor, caption) {
  if (!caption || caption === true) {
    return { ...placeCaption(geom, anchor, caption), kept: { rules: Boolean(caption), flavor: false, keys: false } };
  }
  const { rules = '', flavor = '', keys = false } = caption;
  const steps = [
    { rules, flavor, keys },
    { rules, flavor: '', keys },
    { rules, flavor: '', keys: false },
    { rules: '', flavor: '', keys: false },
  ].filter((step, i, all) => i === 0 || JSON.stringify(step) !== JSON.stringify(all[i - 1]));
  const placed = steps.map((step) => ({
    ...placeCaption(geom, anchor, step.rules || step.flavor || step.keys ? step : false),
    kept: { rules: Boolean(step.rules), flavor: Boolean(step.flavor), keys: Boolean(step.keys) },
  }));
  // The rules are the game: they are given up only for the preview itself, when
  // no step that keeps them leaves the card any room at all.
  const keeping = placed.filter((p) => !rules || p.kept.rules);
  const best = Math.max(...keeping.map((p) => p.zoom));
  if (best <= 0) return placed.find((p) => p.zoom > 0) ?? placed[placed.length - 1];
  return keeping.find((p) => p.zoom > 0 && (p.zoom >= COMFORT_ZOOM || p.zoom >= best - 0.25));
}

function placeCaption(geom, anchor, caption) {
  const { width, height, pad, centre, rowW } = geom;
  const left = pad.left;
  const right = width - pad.right;
  const top = pad.top;
  const bottom = height - pad.bottom;
  const midX = (left + right) / 2;
  const rows = rowExtents(geom);
  const opponentRowBottom = rows.opponent.bottom;
  const playerRowTop = rows.player.top;
  const sideLeft = midX + rowW / 2 + ROW_CLEAR;
  const clearLeft = Math.max(sideLeft, midX + CENTRE_CLEAR);
  const boxes = {
    sideTop: { x: sideLeft, y: top, w: right - sideLeft, h: centre.top - GAP - top },
    sideBottom: { x: sideLeft, y: centre.bottom + GAP, w: right - sideLeft, h: bottom - centre.bottom - GAP },
    side: { x: clearLeft, y: top, w: right - clearLeft, h: bottom - top },
    top: { x: left, y: top, w: right - left, h: playerRowTop - GAP - top },
    bottom: { x: left, y: opponentRowBottom + GAP, w: right - left, h: bottom - opponentRowBottom - GAP },
    full: { x: left, y: top, w: right - left, h: bottom - top },
  };
  const fitted = (place) => ({ place, ...boxes[place], ...fitPreview(boxes[place].w, boxes[place].h, caption) });
  // Largest first; on a tie the halves (listed first, and sort is stable)
  // win over the full height, since they leave the centre line alone.
  const beside = ['sideTop', 'sideBottom', 'side']
    .map(fitted)
    .filter((b) => b.zoom >= SIDE_MIN_ZOOM)
    .sort((a, b) => b.zoom - a.zoom)[0];
  if (beside) return beside;
  return fitted(anchor === 'opponent' ? 'bottom' : anchor === 'player' ? 'top' : 'full');
}

/**
 * The vertical extent of each field row: each is centred in its track, the
 * felt's padding to the centre line on Chuck's side, the centre line to the
 * padding on the player's.
 */
export function rowExtents(geom) {
  const { height, pad, gap, centre, rowH } = geom;
  const top = pad.top;
  const bottom = height - pad.bottom;
  const oppTop = (top + centre.top - gap) / 2 - rowH / 2;
  const playerTop = (centre.bottom + gap + bottom) / 2 - rowH / 2;
  return {
    opponent: { top: oppTop, bottom: oppTop + rowH },
    player: { top: playerTop, bottom: playerTop + rowH },
  };
}
