import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal-dialog behavior for an overlay element.
 *
 * Attach the returned ref to the dialog container and give it
 * role="dialog" aria-modal="true" plus an aria-label/aria-labelledby. The hook
 * focuses the dialog on open, restores focus to the previously-focused element
 * on close, traps Tab focus within the dialog, and closes it on Escape.
 *
 * @param {() => void} onClose called on Escape (and used as the close action)
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

    const focusable = () => Array.from(node.querySelectorAll(FOCUSABLE))
      .filter((el) => !el.disabled && el.offsetParent !== null);

    const first = focusable()[0];
    if (first) {
      first.focus();
    } else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
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
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, []);

  return ref;
}
