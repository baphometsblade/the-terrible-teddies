import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';

// The purchases row, as each check reads it (null: Stripe has not confirmed).
const net = { row: null, checks: 0, balance: 500 };
vi.mock('../utils/pendingPurchase', async (importOriginal) => ({
  ...(await importOriginal()),
  verifyPurchaseSession: async () => { net.checks += 1; if (net.hang) await new Promise(() => {}); return net.row; },
}));
// The server balance after one 500-gem purchase (null: the read failed).
vi.mock('../utils/supabaseClient', () => ({ fetchServerGemBalance: async () => net.balance }));
vi.mock('@/lib/celebrate', () => ({ celebrate: vi.fn() }));
// An owner who has configured a support address.
vi.mock('@/lib/support', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    SUPPORT_EMAIL: 'help@example.com',
    supportMailto: (ref, subject) => actual.supportMailto(ref, subject, 'help@example.com'),
  };
});

const { default: PurchaseSuccess, pendingPollDelay } = await import('./PurchaseSuccess');
const { pendingPurchase, purchaseOnScreen } = await import('../utils/pendingPurchase');
const { useGameStore } = await import('@/stores/gameStore');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
const render = async (sessionId = 'cs_test_pending') => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<PurchaseSuccess sessionId={sessionId} onDone={() => {}} />); });
};
const text = () => host.textContent.replace(/\s+/g, ' ');
const wait = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const button = (label) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === label);

beforeEach(() => {
  vi.useFakeTimers();
  MotionGlobalConfig.skipAnimations = true;
  sessionStorage.clear();
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  Object.assign(net, { row: null, checks: 0, hang: false, balance: 500 });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  MotionGlobalConfig.skipAnimations = false;
  vi.useRealTimers();
});

describe('the background re-check schedule', () => {
  // It stopped after six checks (~24 s) and kept saying it was checking.
  it('starts quick, slows down, and stops after about ten minutes', () => {
    const delays = [];
    for (let n = 0; pendingPollDelay(n) !== null; n++) delays.push(pendingPollDelay(n));
    expect(delays[0]).toBe(4_000);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    const total = delays.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(9 * 60_000);
    expect(total).toBeLessThanOrEqual(10 * 60_000);
  });
});

describe('a payment Stripe has not confirmed yet', () => {
  it('says it is waiting, never that the payment was received', async () => {
    await render();
    expect(text()).toContain('Waiting for Payment Confirmation');
    expect(text()).not.toMatch(/received|within a minute|contact support/i);
    // Remembered, so the gems can still land after this screen closes.
    expect(pendingPurchase()?.sessionId).toBe('cs_test_pending');
  });

  it('gives the reference, and a prefilled email when the owner has set one', async () => {
    await render();
    expect(text()).toContain('cs_test_pending');
    const link = host.querySelector('a[href^="mailto:"]');
    expect(link.textContent).toContain('help@example.com');
    expect(decodeURIComponent(link.getAttribute('href'))).toContain('Order reference: cs_test_pending');
  });

  it('keeps checking, one request at a time, for ten minutes, then says so and stops', async () => {
    await render();
    const first = net.checks;
    await wait(10 * 60_000);
    // Every scheduled check ran, and nothing more.
    let scheduled = 0;
    while (pendingPollDelay(scheduled) !== null) scheduled++;
    expect(net.checks - first).toBe(scheduled);
    expect(text()).toContain('Still Waiting for Stripe');
    expect(text()).toContain('Nothing is lost');

    await wait(10 * 60_000);
    expect(net.checks - first).toBe(scheduled);
  });

  it('lands the gems when a later check finds the payment completed', async () => {
    await render();
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    await wait(4_000);
    expect(text()).toContain('Purchase Complete!');
    expect(useGameStore.getState().gems).toBe(510);
    expect(pendingPurchase()).toBeNull();
  });

  it('Check now asks again at once, says when it did, and starts the schedule over', async () => {
    await render();
    await wait(10 * 60_000);
    expect(text()).toContain('Still Waiting for Stripe');
    const before = net.checks;
    await act(async () => { button('Check now').click(); });
    expect(net.checks).toBe(before + 1);
    expect(text()).toMatch(/Checked at .+: not confirmed yet\./);
    expect(text()).toContain('Waiting for Payment Confirmation');
    await wait(4_000);
    expect(net.checks).toBe(before + 2);
  });
});

describe('coming back to the tab with the screen still open', () => {
  const comeBack = () => act(async () => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // The screen holds the return-to-tab settle off while it is up, and a
  // stalled one had stopped checking: a payment that confirmed meanwhile was
  // never picked up, under copy saying the game checks again on return.
  it('checks a stalled payment once, and lands the gems if it has confirmed', async () => {
    await render();
    await wait(10 * 60_000);
    expect(text()).toContain('Still Waiting for Stripe');
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    const before = net.checks;
    await comeBack();
    // focus and visibilitychange arrive together: one check, not two.
    expect(net.checks).toBe(before + 1);
    expect(text()).toContain('Purchase Complete!');
    expect(useGameStore.getState().gems).toBe(510);
    expect(pendingPurchase()).toBeNull();
  });

  it('starts checking a stalled payment again if it still has not confirmed', async () => {
    await render();
    await wait(10 * 60_000);
    const before = net.checks;
    await comeBack();
    expect(net.checks).toBe(before + 1);
    expect(text()).toMatch(/Checked at .+: not confirmed yet\./);
    expect(text()).toContain('Waiting for Payment Confirmation');
    await wait(4_000);
    expect(net.checks).toBe(before + 2);
  });

  it('does not check on the tab being hidden', async () => {
    await render();
    await wait(10 * 60_000);
    const before = net.checks;
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    } finally {
      visibility.mockRestore();
    }
    expect(net.checks).toBe(before);
  });
});

describe('focus across the phase swap', () => {
  // Check now unmounted with the pending body it sat in, leaving keyboard
  // focus on <body>.
  it('puts focus on the next action when Check now confirms the payment', async () => {
    await render();
    const check = button('Check now');
    check.focus();
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    await act(async () => { check.click(); });
    expect(text()).toContain('Purchase Complete!');
    expect(document.activeElement).toBe(button("Awesome! Let's Play"));
  });

  it('leaves focus that was not lost where it is', async () => {
    // Say a dialog stacked over this one has focus when a background check
    // confirms the payment: the swap must not pull focus out from under it.
    await render();
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    await wait(4_000);
    expect(text()).toContain('Purchase Complete!');
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });
});

describe('leaving before the answer', () => {
  it('remembers the payment from the moment the buyer lands, so closing mid-check loses nothing', async () => {
    net.hang = true;
    await render('cs_test_closed_early');
    expect(text()).toContain('Verifying Payment');
    act(() => root.unmount());
    root = null;
    expect(pendingPurchase()?.sessionId).toBe('cs_test_closed_early');
  });
});

describe('a confirmed payment whose new balance could not be read', () => {
  // The marker used to be dropped before the balance reads, so a failed read
  // (or closing the screen during them) gave up the return-to-tab pick-up.
  it('stays remembered, and leaves the pick-up to the next return to the tab', async () => {
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    net.balance = null;
    await render('cs_test_unread');
    await wait(5_000);
    expect(text()).toContain('Purchase Complete!');
    expect(text()).toContain("couldn't refresh your balance");
    expect(pendingPurchase()?.sessionId).toBe('cs_test_unread');
    // The screen has stopped checking, so it no longer holds the settle off.
    expect(purchaseOnScreen()).toBe(false);
  });

  it('stays remembered when the screen is closed during the balance reads', async () => {
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    net.balance = null;
    await render('cs_test_closed_reading');
    // The first read has failed and the retry is waiting on its timer.
    act(() => root.unmount());
    root = null;
    expect(pendingPurchase()?.sessionId).toBe('cs_test_closed_reading');
  });

  it('is forgotten once the balance is read', async () => {
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    await render('cs_test_read');
    expect(text()).toContain('Purchase Complete!');
    expect(pendingPurchase()).toBeNull();
  });
});

describe('a payment that was reversed', () => {
  // Any row that was not 'completed' used to be told its gems would appear.
  it('says a refunded payment added no gems, and stops waiting', async () => {
    net.row = { status: 'refunded', gems_granted: 500, bundle_id: 'gems_large' };
    await render('cs_test_refunded');
    expect(text()).toContain('Payment Refunded');
    expect(text()).toContain("its gems aren't on your account");
    expect(button('Check now')).toBeUndefined();
    const checks = net.checks;
    await wait(60_000);
    expect(net.checks).toBe(checks);
  });

  it('says a disputed payment\'s gems are off the account until it is settled', async () => {
    net.row = { status: 'disputed', gems_granted: 500, bundle_id: 'gems_large' };
    await render('cs_test_disputed');
    expect(text()).toContain('Payment Disputed');
    expect(text()).toContain('they come back automatically');
    expect(pendingPurchase()).toBeNull();
  });
});
