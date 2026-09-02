/**
 * Make a non-button element (div, motion.div) behave like a button for keyboard
 * and assistive-tech users. Spread the result onto the element and pass an
 * accessible label.
 *
 *   <motion.div {...pressable(() => doThing(), 'Open shop')}>…</motion.div>
 *
 * Pass `enabled: false` when the element is not actionable right now, and it
 * becomes ordinary content: no role, no tab stop, no handler.
 *
 * That third argument exists because the tempting shorthand is to leave the
 * element pressable and put the condition inside the handler —
 * `pressable(() => phase === 'main' && playCard(card), …)`. Sighted players
 * never notice: they can see it is not their turn. But the element still
 * carries role="button", a tab stop, and an accessible name promising an
 * action, so a keyboard or screen-reader user tabs through a row of "Play
 * Whiskey Bear, button" that do nothing when activated. axe cannot flag it —
 * the role is valid, the name is present, and the handler merely declines to
 * act — so the only defence is putting the condition here instead.
 *
 * @param {(e: Event) => void} handler activation handler (click / Enter / Space)
 * @param {string} [label] accessible name (omit if the element has visible text)
 * @param {boolean} [enabled=true] whether the element is actionable right now
 */
export function pressable(handler, label, enabled = true) {
  if (!enabled) return {};
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
