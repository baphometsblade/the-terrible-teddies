import { describe, it, expect, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import Shop from './Shop';
import { useGameStore } from '@/stores/gameStore';

// A route to gems (the Battle Pass confirm when the balance is short, the
// empty Card Packs table) opens the Shop on its gems tab, not on Card Packs.

let host;
let root;
const render = (props) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  MotionGlobalConfig.skipAnimations = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(Shop, { onClose() {}, ...props })));
};
const pressed = () => [...host.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent);

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  MotionGlobalConfig.skipAnimations = false;
});

describe('Shop initialTab', () => {
  it('opens on the tab it is sent to', () => {
    render({ initialTab: 'gems' });
    expect(pressed()).toEqual(['Buy Gems']);
    expect(host.textContent).toContain('Get More Gems');
  });

  it('opens on Card Packs by default, and for a tab it does not have', () => {
    render({});
    expect(pressed()).toEqual(['Card Packs']);
    act(() => root.unmount());
    render({ initialTab: 'nope' });
    expect(pressed()).toEqual(['Card Packs']);
  });
});

// The gems a bundle brings pay any gems owed after a reversed payment first,
// so the balance rises by less than the bundle. The tab says so before the
// buyer pays, rather than the counter seeming short after.
describe('the Buy Gems tab with gems owed', () => {
  afterEach(() => useGameStore.setState(useGameStore.getInitialState(), true));

  it('says what is owed and that new gems pay it first, only while something is', () => {
    useGameStore.setState({ gems: 0, gemDebt: 540 });
    render({ initialTab: 'gems' });
    expect(host.querySelector('[data-gems-owed]').textContent)
      .toBe('You owe 540 gems after a reversed payment. The next gems you get, bought or earned, pay that first.');
    act(() => root.unmount());
    useGameStore.setState({ gems: 300, gemDebt: 0 });
    render({ initialTab: 'gems' });
    expect(host.querySelector('[data-gems-owed]')).toBeNull();
  });
});

// Every count on screen takes a thousands separator. The gem bundles printed
// "1400 total" under "1,200" and "+750 BONUS" beside wallet chips reading
// "1,234".
describe('Shop gem bundles', () => {
  it('write their bonus and total with thousands separators', () => {
    render({ initialTab: 'gems' });
    const lines = [...host.querySelectorAll('[id$="-bonus"], [id$="-total"]')].map((el) => el.textContent.trim());
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toMatch(/^\+?\d{1,3}(?:,\d{3})* (?:BONUS|total)$/);
    // The largest bundle does pass a thousand, so the separator is seen.
    expect(lines.some((line) => line.includes(','))).toBe(true);
  });
});
