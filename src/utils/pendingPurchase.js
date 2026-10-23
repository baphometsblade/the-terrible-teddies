import { supabase } from '../integrations/supabase/supabase';

// Reading a payment's state after the return from Stripe, and remembering one
// Stripe has not confirmed yet. A module of its own, apart from stripe.js:
// useRehydrateOnFocus (on the boot path) needs these, and nothing else of the
// checkout, which only the lazy Shop and purchase screen load.

/**
 * After returning from Stripe, verify a completed session and return the
 * gems_granted amount.  Polls up to maxAttempts times (webhook may be in-flight).
 */
export async function verifyPurchaseSession(sessionId, maxAttempts = 12) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from('purchases')
      .select('gems_granted, bundle_id, status')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (!error && data) return data;

    // Linear back-off: 500ms, 1s, 1.5s … Not after the last attempt, which
    // only delayed the answer: a one-shot "Check now" waited half a second
    // to report what it already knew.
    if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 500 + attempt * 500));
  }
  return null;
}

// A payment the player has returned from but Stripe had not confirmed yet,
// kept per tab (sessionStorage: the Stripe redirect comes back to this tab)
// so the gems can still land after the purchase screen is closed. A day is
// plenty: a new tab, or the next launch, reconciles the balance at login
// anyway, and an entry nobody can settle must not be checked forever.
const PENDING_KEY = 'tt-pending-purchase';
export const PENDING_PURCHASE_TTL_MS = 24 * 60 * 60 * 1000;

// Storage can throw (a private window, blocked site data) or be absent; the
// marker is a convenience on top of the login reconcile, so a failure to
// keep it costs nothing but the early pick-up.
export function rememberPendingPurchase(sessionId, now = Date.now()) {
  if (!sessionId) return;
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ sessionId, since: now }));
  } catch { /* see above */ }
}

export function pendingPurchase(now = Date.now()) {
  try {
    const entry = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
    if (typeof entry?.sessionId !== 'string' || typeof entry.since !== 'number') return null;
    if (now - entry.since > PENDING_PURCHASE_TTL_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

/** Forget the marker, but only if it is still this payment's. */
export function forgetPendingPurchase(sessionId) {
  try {
    const entry = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
    if (entry?.sessionId === sessionId) sessionStorage.removeItem(PENDING_KEY);
  } catch { /* see above */ }
}

// Whether the purchase screen is up and doing its own checking, so a return
// to the tab does not check the same payment a second time and announce it
// twice. A count, not a flag, so StrictMode's mount-unmount-mount nets out.
let purchaseScreens = 0;
export function watchPurchaseOnScreen() {
  purchaseScreens += 1;
  return () => { purchaseScreens -= 1; };
}
export const purchaseOnScreen = () => purchaseScreens > 0;
