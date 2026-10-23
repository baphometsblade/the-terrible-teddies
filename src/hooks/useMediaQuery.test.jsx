import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// A controllable matchMedia: one shared "matches" flag and its listeners.
let matches;
let listeners;
const realMatchMedia = window.matchMedia;

beforeEach(() => {
  matches = false;
  listeners = new Set();
  window.matchMedia = (query) => ({
    media: query,
    get matches() { return matches; },
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  });
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

const Probe = ({ query }) => <span>{useMediaQuery(query) ? 'yes' : 'no'}</span>;

describe('useMediaQuery', () => {
  it('reports the query now and follows it when it changes', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<Probe query="(min-width: 768px)" />));
    expect(container.textContent).toBe('no');

    matches = true;
    await act(async () => listeners.forEach((fn) => fn()));
    expect(container.textContent).toBe('yes');

    await act(async () => root.unmount());
    // Unmounting stops listening, so a long-gone screen is never re-rendered.
    expect(listeners.size).toBe(0);
  });

  it('is false where matchMedia does not exist', async () => {
    window.matchMedia = undefined;
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<Probe query="(min-width: 768px)" />));
    expect(container.textContent).toBe('no');
    await act(async () => root.unmount());
  });
});
