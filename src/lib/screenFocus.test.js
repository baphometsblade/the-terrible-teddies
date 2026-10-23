import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  it('does nothing once cancelled (the screen changed again first)', async () => {
    const cancel = focusWhenReady('[data-screen-root="collection"] h1');
    cancel();
    document.body.innerHTML = '<div data-screen-root="collection"><h1>Card Collection</h1></div>';
    await tick();
    expect(document.activeElement).toBe(document.body);
  });
});
