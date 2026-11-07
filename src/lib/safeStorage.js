// localStorage and sessionStorage throw in more places than they fail:
// Safari private mode (setItem raises QuotaExceededError once the quota is
// 0), Lockdown Mode, and a storage object the page is not allowed to touch
// (the getter itself throws SecurityError). Zustand's persist and supabase-js
// both read storage while the app is still starting. An exception there is
// thrown from a module, which no React error boundary can catch, and the
// loader never leaves.
//
// This wrapper never throws. While the real storage works, every read and
// write goes there, so a normal browser keeps the save. The first failure
// switches that instance to memory for the rest of the page.

/**
 * @param {() => Storage | null | undefined} getBacking
 */
export function createSafeStorage(getBacking) {
  /** @type {Storage | null} */
  let backing = null;
  try {
    const candidate = getBacking();
    if (candidate) {
      // Touch it. A blocked getter throws here, before any key is written.
      candidate.getItem('__tt_probe');
      backing = candidate;
    }
  } catch {
    backing = null;
  }

  /** @type {Map<string, string>} */
  const overlay = new Map();
  let broken = backing == null;

  return {
    /**
     * @param {string} key
     * @returns {string | null}
     */
    getItem(key) {
      if (overlay.has(key)) return overlay.get(key) ?? null;
      if (broken || !backing) return null;
      try {
        return backing.getItem(key);
      } catch {
        broken = true;
        return null;
      }
    },
    /**
     * @param {string} key
     * @param {string} value
     */
    setItem(key, value) {
      const text = String(value);
      if (!broken && backing) {
        try {
          backing.setItem(key, text);
          overlay.delete(key);
          return;
        } catch {
          broken = true;
        }
      }
      overlay.set(key, text);
    },
    /**
     * @param {string} key
     */
    removeItem(key) {
      overlay.delete(key);
      if (broken || !backing) return;
      try {
        backing.removeItem(key);
      } catch {
        broken = true;
      }
    },
    clear() {
      overlay.clear();
      if (broken || !backing) return;
      try {
        backing.clear();
      } catch {
        broken = true;
      }
    },
  };
}

/** @type {ReturnType<typeof createSafeStorage> | null} */
let localStore = null;
/** @type {ReturnType<typeof createSafeStorage> | null} */
let sessionStore = null;

/** @param {'local' | 'session'} kind */
const open = (kind) => () => {
  if (typeof window === 'undefined') return null;
  return kind === 'session' ? window.sessionStorage : window.localStorage;
};

/** One localStorage for the page, or memory when that throws. */
export const browserLocalStorage = () => (localStore ??= createSafeStorage(open('local')));

/** One sessionStorage for the page, or memory when that throws. */
export const browserSessionStorage = () => (sessionStore ??= createSafeStorage(open('session')));
