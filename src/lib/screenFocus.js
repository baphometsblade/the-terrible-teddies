// Where the keyboard focus goes when the screen changes. The control that
// changed it unmounts with the screen it was on (a menu tile, "← Menu"), and
// the focus fell to <body>: a keyboard player started the new screen from
// the top of the page and, back on the menu, tabbed past the whole header to
// reach the tile they had used. Dialogs have useDialog for this; screens had
// nothing.
//
// The new screen arrives late — after the old one's exit, and for the lazy
// ones after their chunk — so this waits for the target to appear.

const lost = () => {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected;
};

const dialogOpen = () => document.documentElement.hasAttribute('data-dialog');

/**
 * Focus the first element matching `selector` once it is in the page, but
 * only if the focus has been lost (it is on <body>, or on an element that
 * has gone): never take it from wherever the player has since put it. While
 * a dialog is open (html[data-dialog]) the dialog owns the focus, so this
 * waits for it to close, however long that takes. A heading is made
 * focusable from script only (tabindex -1), so it is never a tab stop.
 * Gives up once the target has had `timeout` ms, with no dialog open, in
 * which to appear.
 *
 * @returns {() => void} cancel
 */
export function focusWhenReady(selector, { timeout = 10000 } = {}) {
  if (typeof document === 'undefined') return () => {};
  let observer = null;
  let timer = null;
  const stop = () => {
    observer?.disconnect();
    clearTimeout(timer);
    observer = null;
  };
  // The deadline only runs while no dialog is open. It used to run through
  // the wait for one, so a player who spent more than ten seconds in a
  // dialog opened as the screen changed (the result panel's Visit Shop: the
  // menu, with the Shop over it) closed it to find the focus on <body>, as
  // the control the dialog would have handed it back to had gone.
  const arm = () => {
    clearTimeout(timer);
    timer = dialogOpen() ? null : setTimeout(stop, timeout);
  };
  const attempt = () => {
    if (dialogOpen()) return false;
    const el = document.querySelector(selector);
    if (!el) return false;
    if (lost()) {
      if (!el.hasAttribute('tabindex') && !el.matches('button, a[href], input, select, textarea')) {
        el.setAttribute('tabindex', '-1');
      }
      el.focus({ preventScroll: true });
    }
    return true;
  };
  if (attempt()) return () => {};
  observer = new MutationObserver((records) => {
    if (attempt()) stop();
    // Only a dialog opening or closing moves the deadline, so the page's
    // own churn cannot keep putting it off.
    else if (records.some((r) => r.type === 'attributes')) arm();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-dialog'] });
  arm();
  return stop;
}
