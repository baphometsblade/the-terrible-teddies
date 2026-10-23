import { describe, it, expect, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import Shop from './Shop';

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
