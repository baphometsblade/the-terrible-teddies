import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { holdBack, resetHistoryGuard } from './historyGuard';

// What the player's Back does to the page, and what the page does to the
// history. Back is simulated as the browser delivers it: a history.back()
// the module did not make, arriving as a popstate.
const popped = () => new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
const userBack = async () => {
  const arrived = popped();
  window.history.back();
  await arrived;
};
// Lets a back() the module made itself arrive.
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
};
const onGuard = () => window.history.state?.tt === 'tt-back-guard';

beforeEach(async () => {
  resetHistoryGuard();
  // Each test starts on a plain entry of the page, not on a guard a previous
  // test left behind.
  window.history.replaceState(null, '');
});

describe('holdBack', () => {
  it('pushes one guard entry however many layers stack on it', () => {
    const before = window.history.length;
    const a = holdBack(() => {});
    const b = holdBack(() => {});
    expect(window.history.length).toBe(before + 1);
    expect(onGuard()).toBe(true);
    b();
    a();
  });

  it('hands Back to the top layer only, and keeps guarding what is still open', async () => {
    const shop = vi.fn();
    const odds = vi.fn();
    const releaseShop = holdBack(shop);
    const releaseOdds = holdBack(odds);
    await userBack();
    expect(odds).toHaveBeenCalledTimes(1);
    expect(shop).not.toHaveBeenCalled();
    // The odds close as their Back asked; the shop is still open, and the
    // guard is back up for its Back.
    releaseOdds();
    expect(onGuard()).toBe(true);
    await userBack();
    expect(shop).toHaveBeenCalledTimes(1);
    expect(odds).toHaveBeenCalledTimes(1);
    releaseShop();
    await settle();
    expect(onGuard()).toBe(false);
  });

  it('keeps answering Back for a layer that declines to close (a battle that asks)', async () => {
    const ask = vi.fn();
    const release = holdBack(ask);
    await userBack();
    await userBack();
    expect(ask).toHaveBeenCalledTimes(2);
    expect(onGuard()).toBe(true);
    release();
    await settle();
  });

  it('steps off the guard when the last layer closes, without telling anyone', async () => {
    const before = window.history.length;
    const onBack = vi.fn();
    const release = holdBack(onBack);
    release();
    await settle();
    expect(onGuard()).toBe(false);
    expect(onBack).not.toHaveBeenCalled();
    // At most the stepped-off entry is left, as a forward entry the next
    // push replaces.
    expect(window.history.length).toBeLessThanOrEqual(before + 1);
  });

  it('leaves no entries behind after a dialog opens and closes twenty times', async () => {
    const before = window.history.length;
    for (let i = 0; i < 20; i += 1) {
      const release = holdBack(() => {});
      release();
      await settle();
    }
    expect(window.history.length).toBeLessThanOrEqual(before + 1);
    expect(onGuard()).toBe(false);
  });

  it('waits for its own step back before guarding a layer that opens at once (a route)', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const releaseFirst = holdBack(first);
    releaseFirst(); // its back() is now on its way
    const releaseSecond = holdBack(second); // opened before it arrives
    await settle();
    // Our own back() was not mistaken for the player's...
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    // ...and the second layer is guarded once it has arrived.
    expect(onGuard()).toBe(true);
    await userBack();
    expect(second).toHaveBeenCalledTimes(1);
    releaseSecond();
    await settle();
  });

  it('lets Back alone when nothing is open', async () => {
    const release = holdBack(() => {});
    release();
    await settle();
    const before = window.history.length;
    // Nothing registered: the module pushes nothing for it to land on.
    expect(onGuard()).toBe(false);
    expect(window.history.length).toBe(before);
  });

  it('takes a guard a previous page load left behind for a plain entry', async () => {
    // A reload while a dialog was open: the new page starts on the old guard.
    window.history.replaceState({ tt: 'tt-back-guard', page: 'an earlier load' }, '');
    const close = vi.fn();
    const release = holdBack(close);
    expect(window.history.state.page).not.toBe('an earlier load');
    // Back lands on the stale guard, and is the player's Back all the same.
    await userBack();
    expect(close).toHaveBeenCalledTimes(1);
    release();
    await settle();
  });

  it('does not step back off an entry something else has since replaced', async () => {
    const release = holdBack(() => {});
    // App's URL clean-up after a Stripe return replaces the state.
    window.history.replaceState({}, '', window.location.pathname);
    const back = vi.spyOn(window.history, 'back');
    release();
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });
});

// Leaving the page with the guard current: the Shop's Stripe checkout is a
// plain `location.href = url` while the Shop is open. Pushed after the
// guard, the checkout left it in the history, and Back from the checkout
// needed one more press (reloading the game) to get past it.
describe('leaving the page', () => {
  let navigation;
  // A navigation as the Navigation API reports it.
  const leave = (url, { cancelable = true, ...more } = {}) => {
    const e = new Event('navigate', { cancelable });
    Object.assign(e, {
      navigationType: 'push',
      destination: { url, sameDocument: false },
      downloadRequest: null,
      formData: null,
      ...more,
    });
    navigation.dispatchEvent(e);
    return e;
  };
  beforeEach(() => {
    navigation = new EventTarget();
    navigation.navigate = vi.fn(() => ({ committed: Promise.resolve(), finished: Promise.resolve() }));
    window.navigation = navigation;
  });
  afterEach(() => {
    resetHistoryGuard();
    delete window.navigation;
  });

  it('replaces the guard with the page it goes to, rather than leaving it behind', async () => {
    const release = holdBack(() => {});
    const e = leave('https://checkout.stripe.com/c/pay/cs_test_1');
    expect(e.defaultPrevented).toBe(true);
    expect(navigation.navigate).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1', { history: 'replace' });
    release();
    await settle();
  });

  it('leaves every other navigation alone', async () => {
    const release = holdBack(() => {});
    const untouched = [
      leave('https://example.com/', { navigationType: 'replace' }),
      leave('https://example.com/', { navigationType: 'reload' }),
      leave('https://example.com/', { navigationType: 'traverse', cancelable: false }),
      leave('http://localhost/#top', { destination: { url: 'http://localhost/#top', sameDocument: true } }),
      leave('https://example.com/card.png', { downloadRequest: 'card.png' }),
      leave('https://example.com/form', { formData: {} }),
      leave('mailto:support@example.com'),
    ];
    for (const e of untouched) expect(e.defaultPrevented).toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled();
    release();
    await settle();
    // And with nothing open there is no guard to replace.
    expect(leave('https://checkout.stripe.com/c/pay/cs_test_2').defaultPrevented).toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
