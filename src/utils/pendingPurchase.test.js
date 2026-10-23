import { beforeEach, describe, it, expect, vi } from 'vitest';

// verifyPurchaseSession's request, stubbed at the client: each call answers
// with the next row in `answers` (null: no row yet).
const answers = [];
const calls = { from: 0 };
vi.mock('../integrations/supabase/supabase', () => ({
  supabase: {
    from: () => {
      calls.from += 1;
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: answers.length ? answers.shift() : null, error: null }),
      };
      return chain;
    },
  },
}));

const {
  verifyPurchaseSession, rememberPendingPurchase, pendingPurchase, forgetPendingPurchase,
  watchPurchaseOnScreen, purchaseOnScreen, PENDING_PURCHASE_TTL_MS,
} = await import('./pendingPurchase');

beforeEach(() => {
  sessionStorage.clear();
  answers.length = 0;
  calls.from = 0;
  vi.useRealTimers();
});

describe('the pending-purchase marker', () => {
  it('remembers a payment, and forgets only that one', () => {
    rememberPendingPurchase('cs_a', 1000);
    expect(pendingPurchase(2000)).toEqual({ sessionId: 'cs_a', since: 1000 });
    forgetPendingPurchase('cs_other');
    expect(pendingPurchase(2000)?.sessionId).toBe('cs_a');
    forgetPendingPurchase('cs_a');
    expect(pendingPurchase(2000)).toBeNull();
  });

  it('lets a payment nobody settles lapse after a day', () => {
    rememberPendingPurchase('cs_a', 0);
    expect(pendingPurchase(PENDING_PURCHASE_TTL_MS)).not.toBeNull();
    expect(pendingPurchase(PENDING_PURCHASE_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem('tt-pending-purchase')).toBeNull();
  });

  it('survives storage that throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => rememberPendingPurchase('cs_a')).not.toThrow();
    expect(pendingPurchase()).toBeNull();
    expect(() => forgetPendingPurchase('cs_a')).not.toThrow();
    spy.mockRestore();
  });

  it('counts the purchase screens that are watching, so StrictMode nets out', () => {
    const stopA = watchPurchaseOnScreen();
    const stopB = watchPurchaseOnScreen();
    stopA();
    expect(purchaseOnScreen()).toBe(true);
    stopB();
    expect(purchaseOnScreen()).toBe(false);
  });
});

describe('verifyPurchaseSession', () => {
  it('answers a one-shot check at once, without the back-off sleep after it', async () => {
    vi.useFakeTimers();
    let settled = false;
    verifyPurchaseSession('cs_a', 1).then(() => { settled = true; });
    // No timers advanced: a single attempt must not wait out a back-off.
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(calls.from).toBe(1);
  });

  it('still backs off between attempts, and returns the row once it exists', async () => {
    vi.useFakeTimers();
    answers.push(null, { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' });
    const result = verifyPurchaseSession('cs_a', 3);
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toMatchObject({ status: 'completed' });
    expect(calls.from).toBe(2);
  });
});
