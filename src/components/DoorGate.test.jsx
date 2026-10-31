import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { createElement, act, Component } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOOR_KEY, doorRecord } from '@/lib/door';

// The gate in front of the game. TheDoor is stood in for by a stub with one
// button per thing the real door can say (TheDoor.test.jsx has the real one),
// so what is tested here is the gate: who it lets through, what it keeps, and
// what starts only once someone is in.

// How many times the door's chunk was fetched, and whether it should fail to.
const door = { imported: 0, fail: false };

let mounted = [];
let DoorGate;

// A fresh gate (and so a fresh door, which holds its own memory, and fresh
// analytics) per call, with the door's chunk stood in for by a stub that
// counts its own fetches. doMock rather than mock: the stub has to be built
// again after every reset, or a count of fetches would carry over.
const loadGate = async () => {
  vi.resetModules();
  door.imported = 0;
  vi.doMock('./TheDoor', () => {
    door.imported += 1;
    if (door.fail) throw new Error('the door chunk did not arrive');
    return {
      default: ({ state, onPass, onDecline, onOpened }) => React.createElement(
        'div',
        { 'data-testid': 'door', 'data-state': state },
        React.createElement('button', { onClick: onPass }, 'adult'),
        React.createElement('button', { onClick: onDecline }, 'minor'),
        React.createElement('button', { onClick: onOpened }, 'opened'),
      ),
    };
  });
  ({ default: DoorGate } = await import('./DoorGate'));
};
const render = (children = createElement('div', { 'data-testid': 'game' }, 'the game')) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(DoorGate, null, children)));
  mounted.push({ host, root });
  return host;
};
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const press = (host, label) => act(() => {
  [...host.querySelectorAll('button')].find((b) => b.textContent === label).click();
});
const game = (host) => host.querySelector('[data-testid="game"]');
const theDoor = (host) => host.querySelector('[data-testid="door"]');
const quiet = (ms = 30) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  localStorage.clear();
  door.fail = false;
  await loadGate();
});
afterEach(() => {
  for (const { host, root } of mounted) {
    act(() => root.unmount());
    host.remove();
  }
  mounted = [];
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock('./TheDoor');
  vi.doUnmock('@/utils/analytics');
  vi.doUnmock('posthog-js');
});

// The analytics module stood in for, to count when it is asked to start.
const withAnalytics = async () => {
  const init = vi.fn();
  vi.doMock('@/utils/analytics', () => ({ initializePostHog: init }));
  await loadGate();
  return init;
};

describe('a device that has been let in', () => {
  beforeEach(() => localStorage.setItem(DOOR_KEY, doorRecord('pass', 0)));

  it('goes straight to the game, and never fetches the door', async () => {
    const host = render();
    await flush();
    expect(game(host)).not.toBeNull();
    expect(theDoor(host)).toBeNull();
    // The door's chunk is not requested, not even to warm it: a returning
    // player must not pay for it.
    expect(door.imported).toBe(0);
  });

  it('renders the game and nothing else, as it was before the door', () => {
    const host = render();
    expect(host.innerHTML).toBe('<div data-testid="game">the game</div>');
  });

  it('starts the analytics', async () => {
    const init = await withAnalytics();
    render();
    await flush();
    expect(init).toHaveBeenCalledTimes(1);
  });
});

describe('a device with no answer', () => {
  it('sees the door and not the game, and the game is not even mounted', async () => {
    let mountedGame = 0;
    const Game = () => { mountedGame += 1; return createElement('div', { 'data-testid': 'game' }); };
    const host = render(createElement(Game));
    await flush();
    expect(theDoor(host).getAttribute('data-state')).toBe('ask');
    expect(game(host)).toBeNull();
    expect(mountedGame).toBe(0);
  });

  it('starts nothing that sends: no analytics', async () => {
    const init = await withAnalytics();
    const host = render();
    await flush();
    expect(theDoor(host)).not.toBeNull();
    expect(init).not.toHaveBeenCalled();
  });

  it('shows the boot screen while the door\'s chunk arrives', () => {
    const host = render();
    // Synchronously after the first render, before the chunk has resolved.
    expect(host.textContent).toContain('Loading');
    expect(theDoor(host)).toBeNull();
  });

  it('warms the door and its art together', async () => {
    const images = [];
    vi.stubGlobal('Image', class { constructor() { images.push(this); } });
    render();
    await flush();
    expect(door.imported).toBeGreaterThan(0);
    expect(images.map((i) => i.src)).toEqual(['/cards/56.webp']);
    expect(images[0].fetchPriority).toBe('high');
  });

  describe('that is let in', () => {
    it('hears the door open, then the game, and keeps the pass', async () => {
      const host = render();
      await flush();
      press(host, 'adult');
      // The pass is on the device from the moment it is given...
      expect(JSON.parse(localStorage.getItem(DOOR_KEY))).toMatchObject({ v: 1, state: 'pass' });
      // ...the door stays up while it swings, and the game is not mounted yet.
      expect(theDoor(host).getAttribute('data-state')).toBe('opening');
      expect(game(host)).toBeNull();
      press(host, 'opened');
      expect(game(host)).not.toBeNull();
      expect(theDoor(host)).toBeNull();
    });

    it('starts the analytics once the pass is in, and not before', async () => {
      const init = await withAnalytics();
      const host = render();
      await flush();
      expect(init).not.toHaveBeenCalled();
      press(host, 'adult');
      expect(init).toHaveBeenCalledTimes(1);
      press(host, 'opened');
      expect(init).toHaveBeenCalledTimes(1);
    });

    it('is not asked again by a new page', async () => {
      const host = render();
      await flush();
      press(host, 'adult');
      press(host, 'opened');
      await loadGate();
      const again = render();
      await flush();
      expect(game(again)).not.toBeNull();
      expect(theDoor(again)).toBeNull();
    });
  });

  describe('that is turned away', () => {
    it('never sees the game, and keeps the decline', async () => {
      const host = render();
      await flush();
      press(host, 'minor');
      expect(theDoor(host).getAttribute('data-state')).toBe('declined');
      expect(game(host)).toBeNull();
      expect(JSON.parse(localStorage.getItem(DOOR_KEY))).toMatchObject({ v: 1, state: 'declined' });
    });

    it('never starts the analytics', async () => {
      const init = await withAnalytics();
      const host = render();
      await flush();
      press(host, 'minor');
      await flush();
      expect(init).not.toHaveBeenCalled();
    });

    // Reload, a new tab, a deep link: all of them are a new page over the
    // same storage.
    it('is turned away again by a new page, with no game and no analytics', async () => {
      const first = render();
      await flush();
      press(first, 'minor');
      const init = await withAnalytics();
      const again = render();
      await flush();
      expect(theDoor(again).getAttribute('data-state')).toBe('declined');
      expect(game(again)).toBeNull();
      expect(init).not.toHaveBeenCalled();
    });

    it('does not fetch the art for a device that will never see it', async () => {
      localStorage.setItem(DOOR_KEY, doorRecord('declined', 1));
      const images = [];
      vi.stubGlobal('Image', class { constructor() { images.push(this); } });
      render();
      await flush();
      expect(images).toHaveLength(0);
    });
  });

  // Two tabs can both be showing the door.
  describe('with a second tab', () => {
    it('turns this one away too when the other declines', async () => {
      const host = render();
      await flush();
      expect(theDoor(host).getAttribute('data-state')).toBe('ask');
      localStorage.setItem(DOOR_KEY, doorRecord('declined', 5));
      act(() => { window.dispatchEvent(new StorageEvent('storage', { key: DOOR_KEY })); });
      expect(theDoor(host).getAttribute('data-state')).toBe('declined');
    });

    it('ignores another key, and a pass elsewhere', async () => {
      const host = render();
      await flush();
      localStorage.setItem('terrible-teddies-storage', '{}');
      act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'terrible-teddies-storage' })); });
      localStorage.setItem(DOOR_KEY, doorRecord('pass', 5));
      act(() => { window.dispatchEvent(new StorageEvent('storage', { key: DOOR_KEY })); });
      expect(theDoor(host).getAttribute('data-state')).toBe('ask');
    });

    // An empty storage is no answer: the event for a cleared one changes
    // nothing, because the gate only ever tightens.
    it('does nothing when storage is cleared', async () => {
      const host = render();
      await flush();
      localStorage.clear();
      act(() => { window.dispatchEvent(new StorageEvent('storage', { key: null })); });
      expect(theDoor(host).getAttribute('data-state')).toBe('ask');
    });

    // The one that matters: the pass here must never undo a decline there.
    it('does not let this one\'s pass undo the other\'s decline', async () => {
      const init = await withAnalytics();
      const host = render();
      await flush();
      // The other tab declines; this tab has not heard (no storage event).
      localStorage.setItem(DOOR_KEY, doorRecord('declined', 5));
      press(host, 'adult');
      expect(theDoor(host).getAttribute('data-state')).toBe('declined');
      expect(game(host)).toBeNull();
      expect(JSON.parse(localStorage.getItem(DOOR_KEY))).toMatchObject({ state: 'declined', at: 5 });
      expect(init).not.toHaveBeenCalled();
    });

    it('stops listening once the door is answered', async () => {
      const remove = vi.spyOn(window, 'removeEventListener');
      const host = render();
      await flush();
      press(host, 'adult');
      expect(remove.mock.calls.some(([type]) => type === 'storage')).toBe(true);
    });
  });

  describe('with storage blocked', () => {
    const block = () => {
      const refuse = () => { throw new DOMException('denied', 'SecurityError'); };
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
    };

    it('asks, and lets a pass through for the session', async () => {
      block();
      await loadGate();
      const host = render();
      await flush();
      expect(theDoor(host).getAttribute('data-state')).toBe('ask');
      press(host, 'adult');
      press(host, 'opened');
      expect(game(host)).not.toBeNull();
    });

    it('holds a decline for the session, past a remount of the gate', async () => {
      block();
      await loadGate();
      const host = render();
      await flush();
      press(host, 'minor');
      expect(theDoor(host).getAttribute('data-state')).toBe('declined');
      // The page's door remembers it: a remount of the gate (the crash
      // screen's Try Again) does not ask again.
      act(() => { mounted.pop().root.unmount(); });
      host.remove();
      const again = render();
      await flush();
      expect(theDoor(again).getAttribute('data-state')).toBe('declined');
    });
  });
});

// A door that cannot load is not a way in. App's lazy screens sit inside a
// DialogErrorBoundary, which turns a failed chunk into a notice that can be
// dismissed and the game goes on; here that would be a pass without an
// answer, so the failure goes to the error screen, which has none.
describe('a door that will not load', () => {
  class Catcher extends Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? createElement('p', { 'data-testid': 'crash' }, 'crash screen') : this.props.children; }
  }

  it('does not let the game start', async () => {
    // React reports the throw to the window as well as to the boundary: both
    // are expected here, and neither should print.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (e) => e.preventDefault();
    window.addEventListener('error', swallow);
    door.fail = true;
    await loadGate();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ host, root });
    await act(async () => {
      root.render(createElement(Catcher, null, createElement(DoorGate, null, createElement('div', { 'data-testid': 'game' }))));
    });
    await flush();
    window.removeEventListener('error', swallow);
    expect(host.querySelector('[data-testid="crash"]')).not.toBeNull();
    expect(game(host)).toBeNull();
  });

  it('is not wrapped in anything that can dismiss it (source check)', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/DoorGate.jsx'), 'utf8')
      .replace(/\/\/[^\n]*/g, '');
    expect(source).not.toMatch(/DialogErrorBoundary/);
  });
});

// The real analytics module, with only the SDK itself stood in for: what is
// raised at the door is held in memory, and sent only if the door lets the
// player in. (posthog-js is imported by analytics.js only once a key is set
// and initializePostHog runs, so a decline never even loads it.)
describe('the analytics, for real', () => {
  const withKey = async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const posthog = { init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), opt_out_capturing: vi.fn() };
    const sdkLoaded = vi.fn();
    vi.doMock('posthog-js', () => { sdkLoaded(); return { default: posthog }; });
    await loadGate();
    const { trackEvent } = await import('@/utils/analytics');
    return { posthog, sdkLoaded, trackEvent };
  };

  it('starts for a first-ever pass, and then sends what was raised at the door', async () => {
    const { posthog, trackEvent } = await withKey();
    const host = render();
    await flush();
    // Raised before anyone is let in: held in memory, nothing sent.
    trackEvent('raised_at_the_door');
    await quiet();
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();

    press(host, 'adult');
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
    expect(posthog.init.mock.calls[0][0]).toBe('phc_test_key');
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith('raised_at_the_door', {}));
  });

  it('never starts for a decline, never loads the SDK, and never sends what was held', async () => {
    const { posthog, sdkLoaded, trackEvent } = await withKey();
    const host = render();
    await flush();
    trackEvent('raised_at_the_door');
    press(host, 'minor');
    await quiet();
    // ...and a new page, still declined.
    const again = render();
    await flush();
    await quiet();
    expect(theDoor(again).getAttribute('data-state')).toBe('declined');
    expect(sdkLoaded).not.toHaveBeenCalled();
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('starts at once for a returning player, as it did before the door', async () => {
    const { posthog } = await withKey();
    localStorage.setItem(DOOR_KEY, doorRecord('pass', 0));
    render();
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
  });
});
