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

/**
 * Focus the first element matching `selector` once it is in the page, but
 * only if the focus has been lost (it is on <body>, or on an element that
 * has gone): never take it from wherever the player has since put it. While
 * a dialog is open (html[data-dialog]) the dialog owns the focus, so this
 * waits for it to close. A heading is made focusable from script only
 * (tabindex -1), so it is never a tab stop. Gives up after `timeout` ms.
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
  const attempt = () => {
    if (document.documentElement.hasAttribute('data-dialog')) return false;
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
  observer = new MutationObserver(() => { if (attempt()) stop(); });
  observer.observe(document.body, { childList: true, subtree: true });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-dialog'] });
  timer = setTimeout(stop, timeout);
  return stop;
}
