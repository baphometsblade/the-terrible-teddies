import { supabase } from '../integrations/supabase/supabase';

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
      throw new Error(body.error ?? `HTTP ${res.status}`);
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

    // Exponential back-off: 500ms, 1s, 1.5s …
    await new Promise(r => setTimeout(r, 500 + attempt * 500));
  }
  return null;
}
