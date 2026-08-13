// Restore a working `localStorage` under Node >= 26.
//
// Node 26 shipped its own built-in `localStorage` global, gated behind the
// --localstorage-file flag. Without that flag it is installed on globalThis as
// a getter that returns undefined (and prints "localStorage is not available
// because --localstorage-file was not provided"). Because the property already
// exists on globalThis, it shadows the one vitest's jsdom environment would
// otherwise provide — so `environment: 'jsdom'` is set, `window` exists, and
// yet both globalThis.localStorage and window.localStorage are undefined.
//
// The visible symptom was all 45 tests in src/stores/gameStore.test.js failing
// with "Cannot read properties of undefined (reading 'clear')" on the
// localStorage.clear() in their beforeEach — nothing to do with the store.
//
// Node's own implementation is deliberately not used even when the flag is
// present: it persists to a real file on disk, which is the wrong semantics
// for a test double that every suite expects to start empty. This installs a
// spec-shaped in-memory Storage instead, and is a no-op anywhere localStorage
// already works (older Node, browsers, CI on Node 20/22).
if (typeof globalThis.localStorage === 'undefined') {
  const makeStorage = () => {
    const store = new Map();
    return {
      get length() {
        return store.size;
      },
      key(index) {
        return Array.from(store.keys())[index] ?? null;
      },
      getItem(key) {
        const k = String(key);
        return store.has(k) ? store.get(k) : null;
      },
      setItem(key, value) {
        store.set(String(key), String(value));
      },
      removeItem(key) {
        store.delete(String(key));
      },
      clear() {
        store.clear();
      },
    };
  };

  const storage = makeStorage();
  const define = (target) =>
    Object.defineProperty(target, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });

  define(globalThis);
  if (typeof window !== 'undefined' && window !== globalThis) define(window);
}
