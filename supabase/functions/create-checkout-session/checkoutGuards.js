// The checkout function's two security decisions, extracted as pure JS so the
// Vitest suite can reach them (there is no Deno in CI — see eventRouting.js in
// the webhook for the same reasoning).
//
// Both decisions guard the checkout session that is about to be created with
// real money attached, and both are the kind of thing that is silently wrong:
// no exception, no failing build, just a session pointing somewhere it should
// not or priced from a bundle that does not exist.

/**
 * Which origin may appear in the CORS header and — far more importantly — in
 * the success_url and cancel_url Stripe will redirect the buyer to.
 *
 * An unrecognised origin never wins. It falls back to the first configured
 * allowed origin (production), so a request from evil.example cannot turn a
 * Stripe checkout completion into a redirect to evil.example — the open-redirect
 * this allowlist exists to prevent. Returns null when nothing is configured, so
 * the caller refuses rather than building a URL from an empty string.
 *
 * @param {string|null|undefined} requestOrigin the request's Origin header
 * @param {string[]} allowedOrigins configured allowlist, production first
 * @returns {string|null}
 */
export function resolveOrigin(requestOrigin, allowedOrigins) {
  const allowed = (allowedOrigins ?? []).filter(Boolean);
  if (allowed.length === 0) return null;
  // Only an exact match is honoured: no prefix or suffix comparison, because
  // "https://example.com.evil.test".startsWith("https://example.com") is true
  // and that is precisely how allowlists get bypassed.
  if (typeof requestOrigin === 'string' && allowed.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowed[0];
}

/**
 * Look up a bundle by the id the client sent.
 *
 * Own properties only. A bare `table[id]` inherits from Object.prototype, so
 * a client sending "constructor", "toString" or "valueOf" gets a truthy
 * function back and sails past an `if (!bundle)` check — then prices the
 * session from `bundle.price`, which is undefined. That fails on Stripe's side
 * rather than charging anything wrong, but it fails as an opaque 500 instead of
 * the "Invalid bundle ID" 400 the caller deserves, and depending on an
 * accidental downstream error for correctness is not a property worth keeping.
 *
 * @returns the bundle, or null if the id is not a real bundle
 */
export function lookupBundle(table, bundleId) {
  // Belt and braces: hasOwnProperty below already returns false for every
  // non-string id, so removing this line changes no behaviour and no test can
  // catch it. Kept as an explicit statement of the contract, not as
  // load-bearing logic — don't add a test claiming to cover it.
  if (typeof bundleId !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(table ?? {}, bundleId)) return null;
  return table[bundleId] ?? null;
}

/**
 * The two URLs Stripe sends the buyer back to. Built only from an origin that
 * has already been through resolveOrigin.
 */
export function redirectUrls(safeOrigin) {
  return {
    success_url: `${safeOrigin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${safeOrigin}/?purchase=cancelled`,
  };
}

/**
 * Bundles an account may buy once, ever. The Shop sells the Starter Gem Pack
 * as a "NEW PLAYER BOOST", and that was untrue while any account could buy it
 * any number of times. The Shop reads this same list and rule to show the
 * offer as claimed, so the two cannot disagree.
 */
export const ONE_PER_ACCOUNT_BUNDLES = Object.freeze(['starter_bundle']);

export const isOnePerAccount = (bundleId) => ONE_PER_ACCOUNT_BUNDLES.includes(bundleId);

// Purchase statuses that use up the one. 'completed' obviously. 'disputed'
// too: restore_gem_purchase turns it back into 'completed' when a dispute is
// won, so a second one bought during the dispute would end up as two. A
// 'refunded' purchase gave the money back and took the gems, so the offer is
// open again.
const USES_UP_THE_ONE = new Set(['completed', 'disputed']);

/**
 * Whether an account's own purchases rows for a bundle ([{ status }]) already
 * hold its one.
 */
export function holdsBundle(rows) {
  return Array.isArray(rows) && rows.some((row) => USES_UP_THE_ONE.has(row?.status));
}

/**
 * The refusal for a second one-per-account bundle, or null when the checkout
 * may go ahead. `code` lets the client tell this apart from other failures
 * and mark the offer as claimed.
 *
 * @param {string} bundleId
 * @param {{status: string}[]} priorRows this account's purchases of bundleId
 * @returns {{ status: 409, error: string, code: 'already_purchased' } | null}
 */
export function onePerAccountRefusal(bundleId, priorRows) {
  if (!isOnePerAccount(bundleId) || !holdsBundle(priorRows)) return null;
  return {
    status: 409,
    error: "You've already bought the Starter Gem Pack. It's one per account.",
    code: 'already_purchased',
  };
}

// ── One open checkout per account (checkout_holds) ─────────────────────────
//
// The refusal above sees only fulfilled purchases, so a buyer who opened two
// starter checkouts before paying either could pay both. While an account has
// a starter checkout open, the function hands back that same session instead
// of creating a second. The webhook's refund of a second paid starter
// (stripe-webhook/duplicateRefund.js) is what makes it airtight; this is what
// keeps a buyer from being charged twice in the first place.

// Stripe's floor for a Checkout Session's expires_at is 30 minutes after it
// is created; the extra minute absorbs clock skew between this function and
// Stripe, which would otherwise reject the session. Short on purpose: an
// abandoned starter checkout stops blocking a new one after half an hour,
// where Stripe's default is a day.
export const ONE_PER_ACCOUNT_CHECKOUT_TTL_SECONDS = 31 * 60;

/**
 * The expires_at (epoch seconds) to create a session with: short for a
 * one-per-account bundle, Stripe's default (undefined) for the rest.
 */
export function checkoutExpiry(bundleId, nowSeconds) {
  return isOnePerAccount(bundleId) ? Math.floor(nowSeconds) + ONE_PER_ACCOUNT_CHECKOUT_TTL_SECONDS : undefined;
}

export const HOLD_ACTION = Object.freeze({
  CREATE: 'create',   // no open checkout: create one
  REUSE: 'reuse',     // hand back the open one
  REFUSE: 'refuse',   // it was paid; the webhook is crediting it
  REPLACE: 'replace', // it is finished without payment: create one in its place
});

/**
 * What to do about an account's recorded open checkout.
 *
 * @param {{stripe_session_id: string, checkout_url: string}|null} hold
 *   the live checkout_holds row (get_checkout_hold), or null
 * @param {{id: string, status: string, url?: string|null}|null} session
 *   Stripe's copy of that session, or null when Stripe has no such session
 *   (a test-mode id after a switch to live keys, say)
 * @returns {{action: string, url?: string, sessionId?: string, replaces?: string,
 *            status?: number, error?: string, code?: string}}
 */
export function holdDecision(hold, session) {
  if (!hold) return { action: HOLD_ACTION.CREATE };
  if (!session) return { action: HOLD_ACTION.REPLACE, replaces: hold.stripe_session_id };
  // Paid (cards only, so complete means paid): sell nothing more. The same
  // code as the purchases refusal, so the Shop marks the offer claimed.
  if (session.status === 'complete') {
    return {
      action: HOLD_ACTION.REFUSE,
      status: 409,
      error: 'Your Starter Gem Pack payment has gone through, and its gems are on their way. It\'s one per account.',
      code: 'already_purchased',
    };
  }
  // Still open: the same page, however little time it has left. Expiring it
  // to start a fresh one could pull the page out from under a buyer typing
  // their card number into it in another tab; if it lapses, the next tap
  // finds it expired and replaces it.
  if (session.status === 'open') {
    const url = session.url || hold.checkout_url;
    if (url) return { action: HOLD_ACTION.REUSE, url, sessionId: session.id ?? hold.stripe_session_id };
  }
  // Expired (or open with no address to send the buyer to): a new one.
  return { action: HOLD_ACTION.REPLACE, replaces: hold.stripe_session_id };
}

/**
 * Whether a Stripe error from retrieving a session means Stripe has no such
 * session, as against a failure worth refusing on.
 */
export function isMissingStripeSession(err) {
  return err?.code === 'resource_missing' || err?.raw?.code === 'resource_missing' || err?.statusCode === 404;
}

/**
 * After creating a session and claiming the hold (claim_checkout_hold): which
 * session to send the buyer to, and whether the one just created must be
 * expired because a concurrent request claimed the hold first. That session's
 * URL was never handed out, so expiring it cannot interrupt anyone.
 *
 * @param {object[]|null} claimRows the RPC's rows ([{ stripe_session_id, checkout_url, claimed }])
 * @param {{id: string, url: string}} created the session this request created
 * @returns {{url: string, sessionId: string, expireCreated: boolean} | null}
 *   null when the claim gave no answer, so the caller refuses (and expires
 *   what it created)
 */
export function claimOutcome(claimRows, created) {
  const row = Array.isArray(claimRows) ? claimRows[0] : null;
  if (!row || typeof row.claimed !== 'boolean') return null;
  if (row.claimed) return { url: created.url, sessionId: created.id, expireCreated: false };
  if (!row.checkout_url || !row.stripe_session_id) return null;
  return { url: row.checkout_url, sessionId: row.stripe_session_id, expireCreated: true };
}
