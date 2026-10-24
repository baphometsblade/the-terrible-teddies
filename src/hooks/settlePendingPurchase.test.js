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

const { settlePendingPurchase, SETTLED_NOTICE, owedLine } = await import('./settlePendingPurchase');
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
    // Nothing was owed, so nothing more to say.
    expect(toast.mock.calls[0][0].description).toBe('500 gems from your purchase are on your account.');

    // The marker is gone, so the next return sends nothing at all.
    expect(await settlePendingPurchase()).toBe('none');
    expect(net.verifyCalls).toBe(1);
  });

  // Gems owed after a reversed payment are paid first, so the counter rises
  // by less than the purchase: "500 gems ... on your account" over a counter
  // that went from 0 to 10 read as a payment that never arrived.
  it('says how much of a purchase paid gems owed, and how much reached the balance', async () => {
    useGameStore.setState({ gems: 0, gemDebt: 490, lastSyncedServerGems: 2000 });
    rememberPendingPurchase('cs_owed');
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    net.balance = 2500;
    expect(await settlePendingPurchase()).toBe('credited');
    expect([get().gems, get().gemDebt]).toEqual([10, 0]);
    expect(toast.mock.calls[0][0].description).toBe(
      '500 gems from your purchase are on your account. 490 of them paid what was owed after a reversed payment, and 10 went to your balance.',
    );
  });

  // App's sync on a session change can credit the purchase before the settle
  // reads the balance; the settle's own reconcile then adds nothing, and the
  // split is the earlier credit's.
  it('says so when another sync credited the purchase first', async () => {
    useGameStore.setState({ gems: 0, gemDebt: 700, lastSyncedServerGems: 3000 });
    get().reconcileServerGems(3500, 'u-1');
    rememberPendingPurchase('cs_owed_early');
    net.row = { status: 'completed', gems_granted: 500, bundle_id: 'gems_large' };
    net.balance = 3500;
    expect(await settlePendingPurchase()).toBe('credited');
    expect([get().gems, get().gemDebt]).toEqual([0, 200]);
    expect(toast.mock.calls[0][0].description).toBe(
      '500 gems from your purchase are on your account. All of them went to what was owed after a reversed payment, and 200 gems are still owed.',
    );
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

describe('owedLine', () => {
  it('names only the part of this purchase that paid what was owed', () => {
    expect(owedLine(500, { toDebt: 0, toBalance: 500 }, 0)).toBeNull();
    expect(owedLine(500, null, 300)).toBeNull();
    expect(owedLine(500, { toDebt: 500, toBalance: 0 }, 0)).toBe('All of them paid what was owed after a reversed payment.');
    expect(owedLine(1200, { toDebt: 1150, toBalance: 50 }, 0))
      .toBe('1,150 of them paid what was owed after a reversed payment, and 50 went to your balance.');
    // A credit that carried another device's purchase too can have paid more
    // than this one brought: this purchase's share is capped at its own gems.
    expect(owedLine(100, { toDebt: 540, toBalance: 60 }, 0)).toBe('All of them paid what was owed after a reversed payment.');
  });
});
