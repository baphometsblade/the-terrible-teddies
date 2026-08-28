import { vi } from 'vitest';

// posthog-js has real network side effects; stub capture so tests can assert
// on what analytics actually sends without touching the network.
vi.mock('posthog-js', () => ({
  default: { init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn() },
}));

import posthog from 'posthog-js';
import analytics, { initializePostHog } from './analytics';

// posthog-js is now loaded dynamically (it is 225 kB and inert without a key),
// so the module binding is null until initializePostHog resolves. Await it
// here with a stubbed key so these tests exercise the real init path instead
// of the pre-load buffer — without this every assertion below would be
// checking a queued entry rather than a call to the mock.
beforeEach(async () => {
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
  await initializePostHog();
  posthog.capture.mockClear();
  posthog.identify.mockClear();
  posthog.reset.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('analytics.trackError', () => {
  it('defaults to non-fatal', () => {
    analytics.trackError(new Error('boom'), 'gem_purchase');
    expect(posthog.capture).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({ fatal: false, context: 'gem_purchase' })
    );
  });

  it('marks a caller-flagged crash as fatal (ErrorBoundary usage)', () => {
    analytics.trackError(new Error('render crash'), 'react-error-boundary', true);
    expect(posthog.capture).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({ fatal: true, context: 'react-error-boundary' })
    );
  });

  it('stringifies non-Error values safely', () => {
    analytics.trackError('plain string error', 'ctx');
    const [, payload] = posthog.capture.mock.calls.at(-1);
    expect(payload.description).toBe('plain string error');
  });
});

describe('analytics.trackBeginCheckout (purchase-funnel middle)', () => {
  it('emits a GA4 begin_checkout event with the bundle as a USD line item', () => {
    analytics.trackBeginCheckout({ bundleId: 'gems_mega', gems: 3000, price: 49.99 });
    expect(posthog.capture).toHaveBeenCalledWith(
      'begin_checkout',
      expect.objectContaining({
        currency: 'USD',
        value: 49.99,
        items: [expect.objectContaining({ item_id: 'gems_mega', price: 49.99, quantity: 1 })],
      })
    );
  });
});

describe('analytics.identify / reset (per-user attribution)', () => {
  it('identifies with the user id and no PII', () => {
    analytics.identify('11111111-1111-4111-8111-111111111111');
    expect(posthog.identify).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {});
  });

  it('ignores a falsy user id (no anonymous identify)', () => {
    analytics.identify(undefined);
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('reset clears the identity on logout', () => {
    analytics.reset();
    expect(posthog.reset).toHaveBeenCalled();
  });
});
