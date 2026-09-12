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
