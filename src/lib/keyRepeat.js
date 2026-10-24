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
