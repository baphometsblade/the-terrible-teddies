import analytics from './analytics';

// The revenue event for a gem purchase, from wherever the purchase is first
// seen as completed: the purchase screen, or settlePendingPurchase for a buyer
// who left that screen before Stripe confirmed. It used to fire only from the
// screen, so every payment that confirmed after it closed was missing from the
// revenue funnel. A module of its own, small, because settlePendingPurchase
// sits on the boot path and the purchase screen is a lazy dialog.

// Gem bundle prices for analytics, in dollars (mirrors the server-side table
// in create-checkout-session; gemBundles.test.js fails if the two drift, in
// either direction).
export const BUNDLE_PRICES = {
  gems_small: 0.99, gems_medium: 2.99, gems_large: 9.99,
  gems_huge: 19.99, gems_mega: 49.99, starter_bundle: 4.99, weekly_gem_pass: 5.99,
};

const trackedKey = (sessionId) => `tt-purchase-tracked:${sessionId}`;
// The same record in memory, for when storage is blocked: then at least one
// tab cannot count a payment twice.
const trackedHere = new Set();

/**
 * Send the revenue event for one Stripe Checkout session, once. Both callers
 * can see the same payment complete (the screen tracks it even when it could
 * not read the new balance and leaves the gems to the settle), so the session
 * id is remembered in localStorage, which outlives the tab and the reload a
 * buyer may come back through. Returns whether it sent.
 */
export function trackPurchaseOnce(sessionId, purchase) {
  if (!sessionId || !purchase) return false;
  if (trackedHere.has(sessionId)) return false;
  trackedHere.add(sessionId);
  try {
    if (localStorage.getItem(trackedKey(sessionId))) return false;
    localStorage.setItem(trackedKey(sessionId), '1');
  } catch { /* storage blocked: the in-memory record above is all there is */ }
  analytics.trackPurchase({
    itemId: purchase.bundle_id,
    itemName: `${purchase.gems_granted} Gems`,
    price: BUNDLE_PRICES[purchase.bundle_id] ?? 0,
    currency: 'USD',
  });
  return true;
}
