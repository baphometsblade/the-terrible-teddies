import { vi } from 'vitest';

// The buffered-load path in its own file: analytics.js holds module-level state
// (`ph`, `loading`, the attempt counter), so exercising a FAILED init has to
// start from a fresh module registry — analytics.test.js leaves the SDK loaded.
const freshAnalytics = async (initImpl) => {
  vi.resetModules();
  const init = vi.fn(initImpl);
  const capture = vi.fn();
  vi.doMock('posthog-js', () => ({
    default: { init, capture, identify: vi.fn(), reset: vi.fn() },
  }));
  const mod = await import('./analytics');
  return { ...mod, init, capture };
};

const failing = () => { throw new Error('SDK unavailable'); };

beforeEach(() => {
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('posthog-js');
});

// A failed load used to be permanent: `loading` stayed set, so every later
// initializePostHog() returned at the in-flight guard and the pending buffer —
// which exists to hold exactly the early crash reports — filled and was never
// drained. One flaky chunk fetch cost the deploy all of its telemetry.
describe('posthog init failure recovery', () => {
  it('re-arms the load on a later event and ships what was buffered', async () => {
    const { default: analytics, initializePostHog, trackEvent, init, capture } = await freshAnalytics(failing);

    await initializePostHog();
    expect(init).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();

    // Recorded while the SDK is down: must be queued, and must re-arm the load.
    analytics.trackError(new Error('early crash'), 'boot');
    await vi.waitFor(() => expect(init).toHaveBeenCalledTimes(2));

    init.mockImplementation(() => {});
    trackEvent('later_event');
    await vi.waitFor(() => expect(capture).toHaveBeenCalled());

    const names = capture.mock.calls.map(([name]) => name);
    expect(names).toContain('exception');   // the buffered crash report shipped
    expect(names).toContain('later_event');
  });

  it('stops retrying after a bounded number of attempts', async () => {
    const { initializePostHog, trackEvent, init } = await freshAnalytics(failing);

    await initializePostHog();
    for (let i = 0; i < 25; i += 1) trackEvent(`e${i}`);
    await vi.waitFor(() => expect(init.mock.calls.length).toBeGreaterThan(1));
    await Promise.resolve();

    // A permanently blocked SDK (ad blocker, CSP) must not re-import on every
    // single event for the rest of the session.
    expect(init.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('never loads the SDK at all without a key', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { initializePostHog, trackEvent, init } = await freshAnalytics(() => {});

    await initializePostHog();
    trackEvent('anything');
    await Promise.resolve();

    expect(init).not.toHaveBeenCalled();
  });
});
