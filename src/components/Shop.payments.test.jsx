import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import Shop from './Shop';

const calls = [];
globalThis.__ttCheckout = async (bundleId, endpoint) => {
  calls.push({ bundleId, endpoint });
  throw new Error('No checkout URL returned');
};

vi.mock('@/hooks/useSupabaseAuth', () => ({
  useSupabaseAuth: () => ({
    session: { user: { id: '11111111-1111-4111-8111-111111111111' }, access_token: 'tok' },
    loading: false,
  }),
}));

vi.mock('../utils/stripe', () => ({
  redirectToCheckout: (...args) => globalThis.__ttCheckout(...args),
  fetchOnePerAccountHoldings: async () => new Set(),
  CHECKOUT_START_TIMEOUT_MS: 20_000,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: (t) => { globalThis.__ttToast = t; } }),
}));

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

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  MotionGlobalConfig.skipAnimations = false;
  vi.unstubAllEnvs();
  calls.length = 0;
  globalThis.__ttCheckout = async (bundleId, endpoint) => {
    calls.push({ bundleId, endpoint });
    throw new Error('No checkout URL returned');
  };
});

const click = async (el) => {
  await act(async () => {
    el.click();
    await new Promise((r) => setTimeout(r, 20));
  });
};

describe('the shop checkout call', () => {
  it('sends each cash offer to the provider function with that bundle id', async () => {
    vi.stubEnv('VITE_PAYMENT_PROVIDER', 'ccbill');
    render({ initialTab: 'gems' });
    const tiles = [
      ['Buy 50 gems for $0.99', 'gems_small'],
      ['Buy 150 gems for $2.99', 'gems_medium'],
      ['Buy 500 gems for $9.99', 'gems_large'],
      ['Buy 1200 gems for $19.99', 'gems_huge'],
      ['Buy 3000 gems for $49.99', 'gems_mega'],
    ];
    for (const [label, id] of tiles) {
      const tile = [...host.querySelectorAll('[role="button"]')].find((el) => el.getAttribute('aria-label') === label);
      expect(tile, label).toBeTruthy();
      await click(tile);
      expect(calls.at(-1)).toEqual({ bundleId: id, endpoint: 'ccbill-checkout' });
    }

    await click([...host.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Special Offers'));
    await click([...host.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Buy Now'));
    expect(calls.at(-1)).toEqual({ bundleId: 'starter_bundle', endpoint: 'ccbill-checkout' });
    await click([...host.querySelectorAll('button')].find((b) => b.textContent.trim() === '$5.99'));
    expect(calls.at(-1)).toEqual({ bundleId: 'weekly_gem_pass', endpoint: 'ccbill-checkout' });
  });

  it('uses the Stripe function when that provider is selected', async () => {
    vi.stubEnv('VITE_PAYMENT_PROVIDER', 'stripe');
    render({ initialTab: 'gems' });
    const tile = [...host.querySelectorAll('[role="button"]')].find((el) => el.getAttribute('aria-label') === 'Buy 50 gems for $0.99');
    await click(tile);
    expect(calls.at(-1)).toEqual({ bundleId: 'gems_small', endpoint: 'create-checkout-session' });
    expect(host.textContent).toContain('powered by Stripe');
  });

  it('marks the Starter pack claimed when checkout answers already_purchased', async () => {
    vi.stubEnv('VITE_PAYMENT_PROVIDER', 'stripe');
    globalThis.__ttCheckout = async () => {
      throw Object.assign(new Error("You've already bought the Starter Gem Pack. It's one per account."), {
        code: 'already_purchased',
        status: 409,
      });
    };
    render({ initialTab: 'special' });
    await click([...host.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Buy Now'));
    expect(host.textContent).toContain('Claimed');
    expect(globalThis.__ttToast.title).toBe('Already claimed');
    expect([...host.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Buy Now')).toBe(false);
  });
});
