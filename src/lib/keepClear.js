// Keeps a card the keyboard has just focused clear of a screen's sticky
// chrome: the Collection's filter strip over the top of the page, the Deck
// Builder's deck bar along the bottom. The browser scrolls a focused element
// into the window, but knows nothing of what is stuck over the window's edges,
// so a card could take the focus underneath it.
//
// Not scroll-padding on the page, which is what the browser does offer: that
// applies to every scroll into view, the sticky chrome's own controls
// included, so tabbing into the stuck filter strip scrolled the album straight
// back to its top. Not scroll-margin on the cards either: Chrome ignores it
// when deciding whether a focused element needs scrolling at all.
//
// Order-independent: called from the focus handler, it runs before or after
// the browser's own scroll depending on the browser. Before, the card is
// already in the clear when the browser checks, so the browser leaves it;
// after, this corrects where the browser put it.

/**
 * Scrolls `scroller` the least distance that shows `rect` (viewport
 * coordinates) whole between the lines `top` and `bottom`. Where the band is
 * shorter than the rect, the rect's top wins. Returns the distance scrolled.
 */
export function revealBetween(rect, top, bottom, scroller = window) {
  let dy = 0;
  if (rect.top < top) dy = rect.top - top;
  else if (rect.bottom > bottom) dy = Math.min(rect.bottom - bottom, rect.top - top);
  // 'auto' is instant here (the page sets no scroll-behavior): this rides on
  // the browser's own instant focus scroll, and must not be animated past it.
  if (dy !== 0) scroller.scrollBy({ top: dy, behavior: 'auto' });
  return dy;
}

/**
 * Whether a focus event came from the keyboard. Only then is the card moved:
 * a tap on a card half under the bar that scrolled the page between press and
 * release would land on whatever slid under the finger, or on nothing.
 */
export const isKeyboardFocus = (el) => {
  try {
    return !!el?.matches?.(':focus-visible');
  } catch {
    // A browser without :focus-visible: leave the scrolling to the browser
    // rather than risk moving a card under a finger.
    return false;
  }
};

// The gap kept between a focused card and the chrome it is kept clear of.
export const CLEARANCE = 8;
