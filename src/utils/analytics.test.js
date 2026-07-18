import { vi } from 'vitest';

// posthog-js has real network side effects; stub capture so tests can assert
// on what analytics actually sends without touching the network.
vi.mock('posthog-js', () => ({
  default: { init: vi.fn(), capture: vi.fn() },
}));

import posthog from 'posthog-js';
import analytics from './analytics';

beforeEach(() => {
  posthog.capture.mockClear();
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
