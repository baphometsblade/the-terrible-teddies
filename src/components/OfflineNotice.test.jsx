import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import OfflineNotice from './OfflineNotice';

let online = true;
const mounted = [];

const render = () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(OfflineNotice)));
  mounted.push({ host, root });
  return host;
};

beforeEach(() => {
  online = true;
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
});

afterEach(() => {
  while (mounted.length) {
    const { host, root } = mounted.pop();
    act(() => root.unmount());
    host.remove();
  }
});

describe('the offline notice', () => {
  it('stays quiet while the device is online, including with no session', () => {
    const host = render();
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('says so when the connection drops, and steps aside once it is back', () => {
    const host = render();
    online = false;
    act(() => window.dispatchEvent(new Event('offline')));
    const status = host.querySelector('[role="status"]');
    expect(status.textContent).toMatch(/offline/i);
    expect(status.closest('.pointer-events-none')).not.toBeNull();

    online = true;
    act(() => window.dispatchEvent(new Event('online')));
    expect(host.querySelector('[role="status"]').textContent).toMatch(/Back online/);
  });

  it('is up from the first paint when the page itself loaded offline', () => {
    online = false;
    const host = render();
    expect(host.querySelector('[role="status"]').textContent).toMatch(/offline/i);
  });
});
