import { useCallback, useEffect, useState } from 'react';

/**
 * A key held down on a control that spends. Chrome clicks a focused button on
 * every auto-repeat of a held Enter, so one second's hold on a gem tile bought
 * sixteen Legendary packs. Put this on the control's (or its dialog's)
 * onKeyDown and only the first press counts. Space clicks on its single keyup
 * anyway; its repeats would only scroll the page.
 */
export const ignoreKeyRepeat = (e) => {
  if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
};

/**
 * How far apart the two presses of a double-click or a double tap can be.
 * Both used to count.
 */
export const DOUBLE_PRESS_MS = 400;

/**
 * Keeps the press that opened a confirm from also answering it. The confirm
 * opens centred, under the pointer, in the same frame, and the second click
 * of a double-click (or the second tap of a double tap) lands on whatever is
 * there by then. In the Shop at 320 that was the confirm's Buy: 200 gems
 * spent on a confirm the player never saw.
 *
 * For the first `ms` after the confirm mounts, `armed` is false (put
 * pointer-events-none on its buttons, so that click lands on the panel and
 * does nothing) and `whenArmed(fn)` drops calls, for a press that arrives
 * anyway, from the keyboard or a script. Both lift together.
 */
export function useArmedAfterOpen(ms = DOUBLE_PRESS_MS) {
  const [openedAt] = useState(() => Date.now());
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  const whenArmed = useCallback((fn) => (...args) => {
    if (Date.now() - openedAt >= ms) fn(...args);
  }, [openedAt, ms]);
  return { armed, whenArmed };
}
