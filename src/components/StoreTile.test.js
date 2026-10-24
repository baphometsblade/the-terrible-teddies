import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { StoreTile, useStoreBuy, REPEAT_BUY_MS } from './StoreTile';
import { useGameStore, SHOP_ITEMS } from '@/stores/gameStore';

// Paid gems were spent by the first press of a tile, with no confirm, no
// lock and no guard on a held key: a one-second hold of Enter bought sixteen
// Legendary packs, and a double-click bought two. These pin the guard.

const legendary = SHOP_ITEMS.find((i) => i.id === 'legendary_pack');
const coinPack = SHOP_ITEMS.find((i) => i.type === 'pack' && i.currency === 'coins');

let host;
let root;
let now;
const Storefront = ({ items }) => {
  const { requestBuy, confirmNode } = useStoreBuy();
  return createElement(
    Fragment,
    null,
    ...items.map((item) => createElement(StoreTile, { key: item.id, item, onBuy: requestBuy })),
    confirmNode,
  );
};
const render = (items) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(Storefront, { items })));
};
const tile = (item) => host.querySelector(`button[aria-label="Buy ${item.name} for ${item.price} ${item.currency}"]`);
const confirmDialog = () => host.querySelector('[role="dialog"]');
const confirmBuy = (item) => confirmDialog()?.querySelector(`button[aria-label="Buy for ${item.price} gems"]`);
const click = (el) => act(() => el.click());

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  MotionGlobalConfig.skipAnimations = true;
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  // celebrate() skips confetti with Animations off; jsdom has no canvas.
  useGameStore.setState({ gems: 1000, coins: 1000, animationsEnabled: false });
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  MotionGlobalConfig.skipAnimations = false;
  vi.restoreAllMocks();
});

describe('a gem-priced tile', () => {
  it('spends nothing until the confirm says Buy, which opens on Cancel', () => {
    render([legendary]);
    click(tile(legendary));
    expect(useGameStore.getState().gems).toBe(1000);
    expect(useGameStore.getState().legendaryPacks).toBe(0);
    expect(confirmDialog().textContent).toContain(`Buy ${legendary.name}?`);
    expect(confirmDialog().textContent).toContain(`You have 1,000 gems · ${(1000 - legendary.price).toLocaleString()} after`);
    expect(document.activeElement?.textContent).toBe('Cancel');

    click(confirmBuy(legendary));
    expect(useGameStore.getState().gems).toBe(1000 - legendary.price);
    expect(useGameStore.getState().legendaryPacks).toBe(1);
    expect(confirmDialog()).toBeNull();
  });

  it('buys once however many times Buy is pressed in one frame', () => {
    render([legendary]);
    click(tile(legendary));
    const buy = confirmBuy(legendary);
    // Both clicks before React re-renders: the second runs on the same
    // render's handler, so only the cleared ref stops it.
    act(() => { buy.click(); buy.click(); });
    expect(useGameStore.getState().legendaryPacks).toBe(1);
    expect(useGameStore.getState().gems).toBe(1000 - legendary.price);
  });

  it('Cancel spends nothing, and a tile pressed straight after does not reopen it', () => {
    render([legendary]);
    click(tile(legendary));
    click([...confirmDialog().querySelectorAll('button')].find((b) => b.textContent === 'Cancel'));
    expect(confirmDialog()).toBeNull();
    expect(useGameStore.getState().gems).toBe(1000);
    // The second click of a double-click that landed on Cancel.
    click(tile(legendary));
    expect(confirmDialog()).toBeNull();
    now += REPEAT_BUY_MS;
    click(tile(legendary));
    expect(confirmDialog()).not.toBeNull();
  });

  it('goes straight to "Not enough gems" when the balance is short, with no confirm', () => {
    useGameStore.setState({ gems: legendary.price - 1 });
    render([legendary]);
    click(tile(legendary));
    expect(confirmDialog()).toBeNull();
    expect(useGameStore.getState().gems).toBe(legendary.price - 1);
    expect(useGameStore.getState().legendaryPacks).toBe(0);
  });
});

describe('a coin-priced tile', () => {
  it('buys at once, and a double-click buys once', () => {
    render([coinPack]);
    const before = useGameStore.getState().cardPacks;
    click(tile(coinPack));
    expect(confirmDialog()).toBeNull();
    expect(useGameStore.getState().coins).toBe(1000 - coinPack.price);
    click(tile(coinPack));
    expect(useGameStore.getState().coins).toBe(1000 - coinPack.price);
    expect(useGameStore.getState().cardPacks).toBe(before + coinPack.quantity);
    // A deliberate second buy, after the moment has passed, goes through.
    now += REPEAT_BUY_MS;
    click(tile(coinPack));
    expect(useGameStore.getState().coins).toBe(1000 - 2 * coinPack.price);
  });
});

describe('a held key', () => {
  const keydown = (el, init) => {
    const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    act(() => { el.dispatchEvent(e); });
    return e;
  };

  it("cancels Enter's and Space's auto-repeat on a tile and in the confirm, not the first press", () => {
    render([legendary]);
    expect(keydown(tile(legendary), { key: 'Enter', repeat: true }).defaultPrevented).toBe(true);
    expect(keydown(tile(legendary), { key: ' ', repeat: true }).defaultPrevented).toBe(true);
    expect(keydown(tile(legendary), { key: 'Enter' }).defaultPrevented).toBe(false);
    click(tile(legendary));
    const cancel = [...confirmDialog().querySelectorAll('button')].find((b) => b.textContent === 'Cancel');
    expect(keydown(cancel, { key: 'Enter', repeat: true }).defaultPrevented).toBe(true);
    expect(keydown(confirmBuy(legendary), { key: 'Enter', repeat: true }).defaultPrevented).toBe(true);
  });
});
