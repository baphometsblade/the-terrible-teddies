/**
 * Make a non-button element (div, motion.div) behave like a button for keyboard
 * and assistive-tech users. Spread the result onto the element and pass an
 * accessible label.
 *
 *   <motion.div {...pressable(() => doThing(), 'Open shop')}>…</motion.div>
 *
 * @param {(e: Event) => void} handler activation handler (click / Enter / Space)
 * @param {string} [label] accessible name (omit if the element has visible text)
 */
export function pressable(handler, label) {
  return {
    role: 'button',
    tabIndex: 0,
    ...(label ? { 'aria-label': label } : {}),
    onClick: handler,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler(e);
      }
    },
  };
}
