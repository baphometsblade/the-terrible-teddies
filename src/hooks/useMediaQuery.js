import { useCallback, useSyncExternalStore } from 'react';

const mediaQueryList = (query) =>
  (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null);

/**
 * Whether a CSS media query matches right now, kept current as it changes
 * (a window resized across a breakpoint, a phone turned). For the few
 * decisions a stylesheet cannot make on its own — which image a card asks
 * for, say. False where matchMedia does not exist (jsdom, very old browsers).
 */
export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    const mql = mediaQueryList(query);
    if (!mql) return () => {};
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  const getSnapshot = () => !!mediaQueryList(query)?.matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
