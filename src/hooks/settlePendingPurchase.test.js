import { beforeEach, describe, it, expect, vi } from 'vitest';

// The network edges, stubbed: who is signed in, what the purchases row says,
// and what the server balance reads.
const net = { uid: 'u-1', row: null, balance: 510, verifyCalls: 0, balanceCalls: [] };
vi.mock('../utils/supabaseClient', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: net.uid ? { user: { id: net.uid } } : null } }) } },
  fetchServerGemBalance: async (uid) => { net.balanceCalls.push(uid); return net.balance; },
}));
vi.mock('../utils/pendingPurchase', async (importOriginal) => ({
  ...(await importOriginal()),
  verifyPurchaseSession: async () => { net.verifyCalls += 1; return net.row; },
}));
const toast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({ toast: (...a) => toast(...a), useToast: () => ({ toast }) }));
const trackPurchase = vi.fn();
vi.mock('../utils/analytics', () => ({ default: { trackPurchase: (...a) => trackPurchase(...a) } }));

const { settlePendingPurchase, SETTLED_NOTICE } = await import('./settlePendingPurchase');
const { trackPurchaseOnce } = await import('../utils/purchaseAnalytics');
const { rememberPendingPurchase, pendingPurchase, watchPurchaseOnScreen } = await import('../utils/pendingPurchase');
const { useGameStore } = await import('../stores/gameStore');
const get = () => useGameStore.getState();

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({ ownerUserId: 'u-1' });
  Object.assign(net, { uid: 'u-1', row: null, balance: 510, verifyCalls: 0, balanceCalls: [] });
  toast.mockClear();
  trackPurchase.mockClear();
});

describe('settling a payment the player left before it confirmed', () => {
  // The pending screen promised gems "within a minute", but once it was
  // closed they arrived only at the next login or token refresh.
  it('credits a payment that has since completed, once, for the signed-in account', async () => {
    rememberPendingPurchase('cs_late');
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    net.balance = 500;

    expect(await settlePendingPurchase()).toBe('credited');
    expect(get().gems).toBe(510);
    expect(net.balanceCalls).toEqual(['u-1']);
    expect(pendingPurchase()).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Payment confirmed' }));

    // The marker is gone, so the next return sends nothing at all.
    expect(await settlePendingPurchase()).toBe('none');
    expect(net.verifyCalls).toBe(1);
  });

  it('keeps waiting while the row is not there yet, and reconciles nothing', async () => {
    rememberPendingPurchase('cs_slow');
    expect(await settlePendingPurchase()).toBe('pending');
    expect(net.balanceCalls).toEqual([]);
    expect(pendingPurchase()?.sessionId).toBe('cs_slow');
  });

  // refunded_duplicate: a second paid Starter Gem Pack, refunded by the
  // webhook. It used to read as "not confirmed yet" and was checked on every
  // return to the tab for a day.
  // ...and says so: the marker used to go in silence, so a buyer whose second
  // Starter Gem Pack was refunded after they left the screen never heard.
  it('drops a refunded, refunded-duplicate or disputed payment without crediting it, and tells the buyer', async () => {
    const titles = { refunded: 'Payment refunded', refunded_duplicate: 'Payment refunded', disputed: 'Payment disputed' };
    for (const status of ['refunded', 'refunded_duplicate', 'disputed']) {
      toast.mockClear();
      rememberPendingPurchase('cs_back');
      net.row = { status, gems_granted: 500, bundle_id: 'gems_large' };
      expect(await settlePendingPurchase()).toBe(status);
      expect(pendingPurchase()).toBeNull();
      expect(toast).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenCalledWith({ queue: true, ...SETTLED_NOTICE[status] });
      expect(toast.mock.calls[0][0].title).toBe(titles[status]);
    }
    expect(SETTLED_NOTICE.refunded_duplicate.description).toContain('refunded in full');
    expect(net.balanceCalls).toEqual([]);
    expect(get().gems).toBe(10);
    // Nothing was sold.
    expect(trackPurchase).not.toHaveBeenCalled();
  });

  // The revenue event fired only from the purchase screen, so a payment that
  // confirmed after it was closed was never counted.
  it('counts a payment it credits, once, however many settles see it', async () => {
    rememberPendingPurchase('cs_counted');
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    net.balance = 500;
    expect(await settlePendingPurchase()).toBe('credited');
    expect(trackPurchase).toHaveBeenCalledTimes(1);
    expect(trackPurchase).toHaveBeenCalledWith({ itemId: 'gems_large', itemName: '500 Gems', price: 9.99, currency: 'USD' });
    // The same payment again (another tab's marker, say): not a second sale.
    rememberPendingPurchase('cs_counted');
    expect(await settlePendingPurchase()).toBe('credited');
    expect(trackPurchase).toHaveBeenCalledTimes(1);
  });

  // The purchase screen counts a completed payment even when it could not
  // read the balance and leaves the credit to the settle: one sale, not two.
  it('does not count a payment the purchase screen already counted', async () => {
    const row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    expect(trackPurchaseOnce('cs_both', row)).toBe(true);
    rememberPendingPurchase('cs_both');
    net.row = row;
    net.balance = 500;
    expect(await settlePendingPurchase()).toBe('credited');
    expect(trackPurchase).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when no payment is pending: not a reconcile on every focus', async () => {
    expect(await settlePendingPurchase()).toBe('none');
    expect(net.verifyCalls).toBe(0);
  });

  it('leaves the payment to the purchase screen while it is open', async () => {
    rememberPendingPurchase('cs_on_screen');
    const stop = watchPurchaseOnScreen();
    expect(await settlePendingPurchase()).toBe('on-screen');
    expect(net.verifyCalls).toBe(0);
    stop();
  });

  it('runs one check when focus and visibilitychange arrive together', async () => {
    rememberPendingPurchase('cs_twice');
    await Promise.all([settlePendingPurchase(), settlePendingPurchase()]);
    expect(net.verifyCalls).toBe(1);
  });

  it('keeps the payment for next time when the balance cannot be read', async () => {
    rememberPendingPurchase('cs_unread');
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    net.balance = null;
    expect(await settlePendingPurchase()).toBe('unconfirmed');
    expect(pendingPurchase()?.sessionId).toBe('cs_unread');
    expect(toast).not.toHaveBeenCalled();
  });

  it('neither credits nor announces a payment to a save bound to another account', async () => {
    rememberPendingPurchase('cs_switch');
    useGameStore.setState({ ownerUserId: 'u-2' });
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    net.balance = 500;
    expect(await settlePendingPurchase()).toBe('other-account');
    expect(get().gems).toBe(10);
    // Nor is the next player told about the previous buyer's payment, and the
    // payment is still remembered rather than written off as settled.
    expect(toast).not.toHaveBeenCalled();
    expect(pendingPurchase()?.sessionId).toBe('cs_switch');
  });
});
