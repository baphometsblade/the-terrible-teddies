import { describe, it, expect } from 'vitest';
import { createSafeStorage } from './safeStorage';

const memory = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    clear: () => { data.clear(); },
  };
};

describe('safe storage', () => {
  it('reads and writes a storage that works', () => {
    const backing = memory();
    const store = createSafeStorage(() => backing);
    store.setItem('save', '{"coins":1}');
    expect(store.getItem('save')).toBe('{"coins":1}');
    expect(backing.getItem('save')).toBe('{"coins":1}');
    store.removeItem('save');
    expect(store.getItem('save')).toBeNull();
    expect(backing.getItem('save')).toBeNull();
  });

  it('keeps the value in memory when setItem throws, and never throws itself', () => {
    const backing = memory();
    backing.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    const store = createSafeStorage(() => backing);
    expect(() => store.setItem('save', 'kept')).not.toThrow();
    expect(store.getItem('save')).toBe('kept');
    expect(backing.getItem('save')).toBeNull();
    expect(() => store.clear()).not.toThrow();
  });

  it('uses memory when even reaching the storage throws', () => {
    const store = createSafeStorage(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(() => store.setItem('door', 'pass')).not.toThrow();
    expect(store.getItem('door')).toBe('pass');
    store.removeItem('door');
    expect(store.getItem('door')).toBeNull();
  });

  it('treats a missing storage as memory', () => {
    const store = createSafeStorage(() => null);
    store.setItem('k', 'v');
    expect(store.getItem('k')).toBe('v');
  });
});
