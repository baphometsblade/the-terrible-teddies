import { useEffect, useRef } from 'react';
import { holdBack } from '@/lib/historyGuard';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// All currently-mounted dialogs, in mount order. Only the top of the stack
// handles Escape/Tab: multiple dialogs can be open at once (e.g. a purchase
// screen and the daily-rewards auto-open), and since every instance listens on
// document, stopPropagation() can't stop sibling listeners — without the stack
// a single Escape would close every open dialog and the Tab traps would fight.
const dialogStack = [];

// Mirrors "is any dialog open" onto <html data-dialog>, where a stylesheet can
// see it: index.css moves toasts off the dialog's controls while it is set
// (they sit above every dialog, and in their usual places a claim's toast
// covered Close on a phone and the bonus Claim on a desktop). Counted from
// the stack, so closing one of two stacked dialogs leaves it set.
const markOpen = () => {
  document.documentElement.toggleAttribute('data-dialog', dialogStack.length > 0);
};

/**
 * Accessible modal-dialog behavior for an overlay element.
 *
 * Attach the returned ref to the dialog container and give it
 * role="dialog" aria-modal="true" plus an aria-label/aria-labelledby. The hook
 * focuses the dialog on open, restores focus to the previously-focused element
 * on close, traps Tab focus within the dialog, and closes it on Escape — and
 * on the system's Back (src/lib/historyGuard.js), which used to leave the
 * game from under an open dialog. Back reaches the top dialog only, as
 * Escape does.
 *
 * @param {() => void} onClose called on Escape and Back (and used as the close action)
 */
export function useDialog(onClose) {
  const ref = useRef(null);
  // Keep the latest onClose without re-running the effect (which would steal
  // focus back to the top on every parent render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement;
    dialogStack.push(node);
    markOpen();
    // Held in the same order as dialogStack, so Back and Escape agree on
    // which dialog is on top.
    const releaseBack = holdBack(() => onCloseRef.current?.());

    // Skips inert subtrees: a dialog that makes part of itself inert (the
    // Shop does while a checkout is starting) must not have the trap walk
    // Tab back into the part it shut.
    const focusable = () => Array.from(node.querySelectorAll(FOCUSABLE))
      .filter((el) => !el.disabled && el.offsetParent !== null && !el.closest('[inert]'));

    // The first control, unless the dialog marks the one it should open on
    // with data-autofocus: the battle's result panel has an upsell above Play
    // Again, and the first control took Enter to the Shop.
    const items = focusable();
    const first = items.find((el) => el.hasAttribute('data-autofocus')) ?? items[0];
    if (first) {
      first.focus();
    } else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    // Listen on document, not the node: if the focused control unmounts
    // mid-dialog (e.g. the "open pack" button during the reveal), focus falls
    // back to <body> and a node-level listener would never see the Escape.
    const onKeyDown = (e) => {
      // Only the most-recently-opened dialog owns the keyboard.
      if (dialogStack[dialogStack.length - 1] !== node) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (!node.contains(active)) {
        // Focus escaped (or its element unmounted) — pull it back in.
        e.preventDefault();
        firstEl.focus();
      } else if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      releaseBack();
      // Remove by index — dialogs don't always unmount in LIFO order.
      const i = dialogStack.indexOf(node);
      if (i !== -1) dialogStack.splice(i, 1);
      markOpen();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, []);

  return ref;
}
