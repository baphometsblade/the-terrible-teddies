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
// Beside the rows only from this size; smaller, the card reads better over
// the half of the table it does not hide.
export const SIDE_MIN_ZOOM = 1.4;
// The caption (the ability's rules, the keyboard's keys): under the card, at
// least CAPTION_W wide and CAPTION_H tall (the longest rules line runs to four
// lines there); beside it, CAPTION_ROW_W wide, where it may run a line longer
// since it has the card's height to fill.
export const CAPTION_W = 160;
export const CAPTION_H = 96;
export const CAPTION_ROW_W = 140;
const GAP = 8;
// The centre line's turn plaque and targeting prompt are centred on the
// felt, and neither reaches further than this either side of the middle.
export const CENTRE_CLEAR = 140;
// Room between a row's last card and the preview: the target crosshair
// stands 10px proud of a card's corner.
const ROW_CLEAR = 16;

const floor2 = (n) => Math.floor(n * 100) / 100;

/**
 * The largest zoom at which the card (and its caption, if any) fits a w x h
 * box: the caption under the card ('column') or beside it ('row'), whichever
 * lets the card be bigger. A short, wide box — half a phone's felt — takes
 * the caption beside the card; under it, the card would barely beat the size
 * it already is on the table.
 */
export function fitPreview(w, h, caption) {
  if (!(w > 0 && h > 0)) return { zoom: 0, layout: 'column' };
  const column = caption && w < CAPTION_W
    ? 0
    : Math.min(MAX_PREVIEW_ZOOM, (h - (caption ? CAPTION_H + GAP : 0)) / CARD_H, w / CARD_W);
  const row = caption
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
    ? { w: card.w + GAP + CAPTION_ROW_W, h: Math.max(card.h, CAPTION_H) }
    : { w: Math.max(card.w, CAPTION_W), h: card.h + GAP + CAPTION_H };
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
 * Beside the rows wins where there is room for it at SIDE_MIN_ZOOM: there it
 * covers no card at all. The beside-the-rows boxes are the two halves above
 * and below the centre line, and the full height kept clear of the centre
 * line's plaque and prompt. Failing that, the half of the felt away from the
 * anchor's row; for a hand card, the whole felt.
 *
 * Returns { place, x, y, w, h, zoom, layout }: the box to centre the preview
 * in, and how to draw it there.
 */
export function placePreview(geom, anchor, caption) {
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
