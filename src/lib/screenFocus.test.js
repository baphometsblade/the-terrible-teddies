import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { focusWhenReady } from './screenFocus';

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-dialog');
});
afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-dialog');
});

describe('focusWhenReady', () => {
  it('waits for a screen that arrives late, then focuses its heading', async () => {
    const cancel = focusWhenReady('[data-screen-root="collection"] h1');
    expect(document.activeElement).toBe(document.body);
    document.body.innerHTML = '<div data-screen-root="collection"><h1>Card Collection</h1><button>x</button></div>';
    await tick();
    const h1 = document.querySelector('h1');
    expect(document.activeElement).toBe(h1);
    // Focusable from script, never a tab stop.
    expect(h1.getAttribute('tabindex')).toBe('-1');
    cancel();
  });

  it('hands the focus back to a menu tile, which keeps its own tab stop', async () => {
    document.body.innerHTML = '<div data-screen-root="menu"><div role="button" tabindex="0" data-dest="collection">Collection</div></div>';
    focusWhenReady('[data-screen-root="menu"] [data-dest="collection"]');
    const tile = document.querySelector('[data-dest]');
    expect(document.activeElement).toBe(tile);
    expect(tile.getAttribute('tabindex')).toBe('0');
  });

  it('never takes the focus from where the player has put it', async () => {
    document.body.innerHTML = '<input id="mine"><div data-screen-root="deck"><h1>Deck Builder</h1></div>';
    const mine = document.getElementById('mine');
    mine.focus();
    focusWhenReady('[data-screen-root="deck"] h1');
    expect(document.activeElement).toBe(mine);
  });

  it('waits while a dialog has the focus, and moves it once the dialog has gone', async () => {
    document.documentElement.setAttribute('data-dialog', '');
    document.body.innerHTML = '<div data-screen-root="game"><h1>Battle</h1></div>';
    const cancel = focusWhenReady('[data-screen-root="game"] h1');
    await tick();
    expect(document.activeElement).toBe(document.body);
    document.documentElement.removeAttribute('data-dialog');
    await tick();
    expect(document.activeElement).toBe(document.querySelector('h1'));
    cancel();
  });

  // The result panel's Visit Shop goes to the menu and opens the Shop over
  // it. The deadline used to run on through the Shop, so after more than ten
  // seconds there, closing it left the focus on <body>.
  describe('its deadline', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    // Lets the MutationObserver's callback run.
    const settle = () => vi.advanceTimersByTimeAsync(0);

    it('does not run while a dialog is open, however long it stays', async () => {
      document.documentElement.setAttribute('data-dialog', '');
      const cancel = focusWhenReady('[data-screen-root="menu"] [data-dest="game"]');
      await vi.advanceTimersByTimeAsync(15000);
      document.documentElement.removeAttribute('data-dialog');
      await settle();
      document.body.innerHTML = '<div data-screen-root="menu"><div role="button" tabindex="0" data-dest="game">Battle</div></div>';
      await settle();
      expect(document.activeElement).toBe(document.querySelector('[data-dest]'));
      cancel();
    });

    it('runs again once the dialog has gone, and gives up at its end', async () => {
      document.documentElement.setAttribute('data-dialog', '');
      focusWhenReady('[data-screen-root="game"] h1', { timeout: 1000 });
      await vi.advanceTimersByTimeAsync(5000);
      document.documentElement.removeAttribute('data-dialog');
      await settle();
      await vi.advanceTimersByTimeAsync(1001);
      document.body.innerHTML = '<div data-screen-root="game"><h1>Battle</h1></div>';
      await settle();
      expect(document.activeElement).toBe(document.body);
    });

    it('is not put off by the page changing under it', async () => {
      focusWhenReady('[data-screen-root="game"] h1', { timeout: 1000 });
      await vi.advanceTimersByTimeAsync(600);
      document.body.appendChild(document.createElement('div'));
      await settle();
      await vi.advanceTimersByTimeAsync(401);
      document.body.innerHTML = '<div data-screen-root="game"><h1>Battle</h1></div>';
      await settle();
      expect(document.activeElement).toBe(document.body);
    });
  });

  it('does nothing once cancelled (the screen changed again first)', async () => {
    const cancel = focusWhenReady('[data-screen-root="collection"] h1');
    cancel();
    document.body.innerHTML = '<div data-screen-root="collection"><h1>Card Collection</h1></div>';
    await tick();
    expect(document.activeElement).toBe(document.body);
  });
});
