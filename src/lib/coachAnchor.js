// The first-fight ring is drawn on the card, so it moves with the card when
// the row scrolls or the board is zoomed. What it cannot do by itself is
// notice that a resize pushed that card out of its scroller. This brings it
// back, and only when it is actually clipped, so a finger scrolling the hand
// is not dragged back onto the lesson.

const boxOf = (el) => el.getBoundingClientRect();

export const coachTargetClipped = (el, scroller) => {
  const card = boxOf(el);
  const view = boxOf(scroller);
  if (card.width === 0 && card.height === 0) return false;
  return card.right < view.left + 1
    || card.left > view.right - 1
    || card.bottom < view.top + 1
    || card.top > view.bottom - 1;
};

/** Scroll the marked card into view when a resize has pushed it out. */
export const anchorCoachTarget = (root) => {
  const el = root?.querySelector?.('[data-coach-target]');
  if (!el || typeof el.scrollIntoView !== 'function') return false;
  const scroller = el.closest?.('[data-coach-scroll]');
  if (scroller && coachTargetClipped(el, scroller)) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return true;
};
