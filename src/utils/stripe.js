import { supabase } from '../integrations/supabase/supabase';
// The checkout function's own rule for what uses up a one-per-account bundle,
// so the Shop's "claimed" can never disagree with the 409 the server sends.
import { ONE_PER_ACCOUNT_BUNDLES, holdsBundle } from '../../supabase/functions/create-checkout-session/checkoutGuards.js';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Generous: a cold edge function plus Stripe's session create is a few
// seconds. Exported so the e2e suite can reason about it.
export const CHECKOUT_START_TIMEOUT_MS = 20_000;

/**
 * Creates a Stripe Checkout Session and redirects the browser to it.
 * Throws if the edge function returns an error.
 */
export async function redirectToStripeCheckout(bundleId) {
  // Get current user's JWT for secure server-side verification
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Please sign in to purchase gems');
  }

  // Bounded. Shop covers the whole screen with a spinner while this runs —
  // no text, no cancel — and only clears it when this throws. Unbounded, a
  // stalled or cold edge function left the buyer staring at a lone spinning
  // gem until the browser itself gave up, which can take minutes. Giving up
  // is safe: nothing is charged until the buyer completes Stripe's own page,
  // which they never reached.
  // The signal stays armed through the body read as well as the request: a
  // response whose headers arrive but whose body stalls hangs just the same.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECKOUT_START_TIMEOUT_MS);
  let url;
  try {
    const res = await fetch(`${FUNCTIONS_URL}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ bundle_id: bundleId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Network error' }));
      // The status and the function's code ride along, so the Shop can tell
      // "you already have the Starter pack" (409, already_purchased) from a
      // failure worth retrying.
      throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), {
        status: res.status,
        code: body.code ?? null,
      });
    }
    ({ url } = await res.json());
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error("Checkout is taking too long to start. You haven't been charged — please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!url) throw new Error('No checkout URL returned');

  window.location.href = url;
}

/**
 * Which one-per-account bundles (the Starter Gem Pack) this account already
 * holds, read from its own purchases rows (purchases_select_own). Returns a
 * Set of bundle ids, or null when the read fails — unknown, not "none": the
 * checkout function enforces the rule either way.
 */
export async function fetchOnePerAccountHoldings(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('purchases')
    .select('bundle_id, status')
    .eq('user_id', userId)
    .in('bundle_id', ONE_PER_ACCOUNT_BUNDLES);
  if (error || !Array.isArray(data)) return null;
  return new Set(ONE_PER_ACCOUNT_BUNDLES.filter((id) => holdsBundle(data.filter((row) => row.bundle_id === id))));
}

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
