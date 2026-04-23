import { supabase } from '../integrations/supabase/supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_PROJECT_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_API_KEY;

/**
 * Creates a Stripe Checkout Session and redirects the browser to it.
 * Throws if the edge function returns an error.
 */
export async function redirectToStripeCheckout(bundleId, userId) {
  const res = await fetch(`${FUNCTIONS_URL}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({
      bundle_id: bundleId,
      user_id: userId ?? null,
      origin: window.location.origin,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  const { url } = await res.json();
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
