// Which CCBill webhook means what, and whether the post is really from CCBill.
// Pure: no Deno, no network. Vitest imports it the same way it imports the
// Stripe webhook's eventRouting.js.
//
// Authenticity is CCBill's dynamic-pricing response digest:
//   approval  MD5(subscriptionId + "1" + salt)
//   denial    MD5(denialId + "0" + salt)
// Webhooks send it as dynamicPricingValidationDigest or responseDigest.
// Refund, chargeback and void are about an approved subscription, so they
// carry the approval digest. An optional IP allowlist (CCBILL_WEBHOOK_IPS)
// is applied first when the operator sets one.

import { lookupBundle } from '../create-checkout-session/checkoutGuards.js';
import { approvalDigest, denialDigest, digestEqual } from '../ccbill-checkout/flexforms.js';
import { reversalNotFoundAction } from '../stripe-webhook/eventRouting.js';
import { isOnePerAccountRefusal } from '../stripe-webhook/duplicateRefund.js';

export const ACTION = Object.freeze({
  FULFILL: 'fulfill',
  REVERSE: 'reverse',
  IGNORE: 'ignore',
});

// CCBill's published postback / webhook ranges: Ashburn, Amsterdam, Phoenix.
export const CCBILL_PUBLISHED_WEBHOOK_RANGES = Object.freeze([
  '64.38.212.0/24',
  '64.38.215.0/24',
  '64.38.240.0/24',
  '64.38.241.0/24',
]);

const USER_KEYS = ['X-userId', 'userId', 'X-user_id', 'user_id'];
const BUNDLE_KEYS = ['X-bundleId', 'bundleId', 'X-bundle_id', 'bundle_id'];
const DIGEST_KEYS = ['dynamicPricingValidationDigest', 'responseDigest', 'response_digest'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function field(payload, names) {
  if (!payload || typeof payload !== 'object') return null;
  for (const name of names) {
    const value = payload[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function eventType(payload) {
  return field(payload, ['eventType', 'event_type']);
}

export function priceToCents(value) {
  if (value == null) return null;
  const text = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const frac = (match[2] ?? '').padEnd(2, '0');
  return Number(match[1]) * 100 + Number(frac);
}

export function currencyIsUsd(value) {
  if (value == null) return false;
  const text = String(value).trim().toLowerCase();
  return text === '840' || text === 'usd';
}

export function expectedResponseDigest(payload, salt) {
  if (typeof salt !== 'string' || salt.length === 0) return null;
  const type = eventType(payload);
  if (type === 'NewSaleFailure') {
    const denialId = field(payload, ['denialId', 'denial_id']);
    return denialId ? denialDigest(denialId, salt) : null;
  }
  if (type === 'NewSaleSuccess' || type === 'Refund' || type === 'Chargeback' || type === 'Void') {
    const subscriptionId = field(payload, ['subscriptionId', 'subscription_id']);
    return subscriptionId ? approvalDigest(subscriptionId, salt) : null;
  }
  return null;
}

export function verifyResponseDigest(payload, salt) {
  const expected = expectedResponseDigest(payload, salt);
  const presented = field(payload, DIGEST_KEYS);
  if (!expected || !presented) return false;
  return digestEqual(presented, expected);
}

// Null means the operator did not configure an allowlist, so the digest is
// the only check. A list, once set, fails closed.
export function parseWebhookIps(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const entries = text.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean);
  return entries.length ? entries : null;
}

function ipv4ToInt(ip) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

export function ipInEntry(ip, entry) {
  const address = ipv4ToInt(ip);
  if (address == null || typeof entry !== 'string') return false;
  if (!entry.includes('/')) return address === ipv4ToInt(entry);
  const [base, bitsText] = entry.split('/');
  const bits = Number(bitsText);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const network = ipv4ToInt(base);
  if (network == null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (address & mask) === (network & mask);
}

export function ipAllowed(ip, allowlist) {
  if (allowlist == null) return true;
  if (typeof ip !== 'string' || !ip) return false;
  return allowlist.some((entry) => ipInEntry(ip, entry));
}

// x-real-ip is the address the platform saw. Otherwise the last X-Forwarded-For
// hop, which a proxy appends — the first hop is whatever the caller wrote.
export function clientIpFromHeaders(headers) {
  const get = (name) => {
    if (!headers) return null;
    if (typeof headers.get === 'function') return headers.get(name);
    return headers[name] ?? headers[name.toLowerCase()] ?? null;
  };
  const real = get('x-real-ip');
  if (typeof real === 'string' && real.trim()) return real.trim();
  const forwarded = get('x-forwarded-for');
  if (typeof forwarded !== 'string') return null;
  const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

export function authenticateWebhook(payload, { salt, allowlist, ip }) {
  if (!ipAllowed(ip, allowlist)) return { ok: false, status: 403, error: 'Forbidden' };
  if (!verifyResponseDigest(payload, salt)) return { ok: false, status: 400, error: 'Invalid digest' };
  return { ok: true };
}

function reversalPlan(payload) {
  const type = eventType(payload);
  const subscriptionId = field(payload, ['subscriptionId', 'subscription_id']);
  if (!subscriptionId) return { action: ACTION.IGNORE, ignored: 'no_subscription' };
  const currency = field(payload, [
    'billedCurrencyCode', 'billedCurrency', 'accountingCurrencyCode', 'accountingCurrency', 'currencyCode',
  ]);
  if (currency && !currencyIsUsd(currency)) return { action: ACTION.IGNORE, ignored: 'currency_mismatch' };
  const original = priceToCents(field(payload, ['billedInitialPrice', 'subscriptionInitialPrice', 'accountingInitialPrice']));
  const refunded = priceToCents(field(payload, ['billedAmount', 'accountingAmount', 'amount']));
  if (type === 'Refund') {
    // Same direction as Stripe: a missing amount is not treated as a full
    // refund, and a smaller one leaves the gems in place.
    if (original == null || refunded == null) return { action: ACTION.IGNORE, ignored: 'refund_amount_unknown' };
    if (refunded < original) return { action: ACTION.IGNORE, ignored: 'partial_refund' };
    if (refunded !== original) return { action: ACTION.IGNORE, ignored: 'refund_amount_mismatch' };
  } else if (original != null && refunded != null && refunded < original) {
    return { action: ACTION.IGNORE, ignored: 'partial_refund' };
  }
  return {
    action: ACTION.REVERSE,
    paymentIntent: subscriptionId,
    reversalReason: type === 'Chargeback' ? 'disputed' : 'refunded',
  };
}

export function routeEvent(payload) {
  const type = eventType(payload);
  if (type === 'NewSaleSuccess') return { action: ACTION.FULFILL };
  if (type === 'NewSaleFailure') return { action: ACTION.IGNORE, ignored: 'sale_failed' };
  if (type === 'Refund' || type === 'Chargeback' || type === 'Void') return reversalPlan(payload);
  return { action: ACTION.IGNORE, ignored: 'unhandled' };
}

/**
 * The fulfill_gem_purchase arguments for a paid sale, or a refusal.
 * Amount and currency are taken from what CCBill billed, never from the
 * custom fields, and checked against the server bundle table.
 */
export function saleCredit(payload, bundles) {
  const userId = field(payload, USER_KEYS);
  const bundleId = field(payload, BUNDLE_KEYS);
  const transactionId = field(payload, ['transactionId', 'transaction_id']);
  const subscriptionId = field(payload, ['subscriptionId', 'subscription_id']);
  if (!userId || !UUID_RE.test(userId)) return { ok: false, status: 500, error: 'Invalid user binding' };
  const bundle = lookupBundle(bundles, bundleId);
  if (!bundle) return { ok: false, status: 500, error: 'Unknown bundle' };
  const currency = field(payload, [
    'billedCurrencyCode', 'billedCurrency', 'currencyCode', 'accountingCurrencyCode', 'accountingCurrency',
  ]);
  if (!currencyIsUsd(currency)) return { ok: false, status: 500, error: 'Currency mismatch' };
  const cents = priceToCents(field(payload, [
    'billedInitialPrice', 'accountingInitialPrice', 'subscriptionInitialPrice',
  ]));
  if (cents == null || cents !== bundle.price) return { ok: false, status: 500, error: 'Amount mismatch' };
  if (!transactionId) return { ok: false, status: 500, error: 'Missing transaction' };
  return {
    ok: true,
    rpc: {
      p_user_id: userId,
      p_bundle_id: bundleId,
      p_gems: bundle.gems + bundle.bonus,
      p_session_id: transactionId,
      p_amount: cents,
      p_payment_intent: subscriptionId || transactionId,
    },
  };
}

export function fulfillmentSuccessResponse(outcome) {
  if (outcome === 'credited' || outcome === 'duplicate') {
    return { status: 200, body: { received: true, outcome } };
  }
  return { status: 500, body: { error: 'Fulfillment failed' } };
}

// A second starter is not credited. CCBill has no refund call on the secrets
// this function holds, so the delivery fails and stays visible for a refund
// in the CCBill admin. It is not recorded as refunded_duplicate: that status
// would tell the buyer the money was already back.
export function fulfillmentErrorResponse(rpcError) {
  if (isOnePerAccountRefusal(rpcError)) {
    return { status: 500, outcome: 'one_per_account_refund_required', credited: false };
  }
  return { status: 500, outcome: 'fulfillment_failed', credited: false };
}

export function reversalResponse(outcome, createdSeconds, nowSeconds) {
  if (outcome === 'not_found') {
    if (reversalNotFoundAction(createdSeconds, nowSeconds) === 'retry') {
      return { status: 409, body: { received: false, outcome: 'not_found' } };
    }
    return { status: 200, body: { received: true, outcome: 'not_found' } };
  }
  if (outcome === 'reversed' || outcome === 'already_reversed') {
    return { status: 200, body: { received: true, outcome } };
  }
  return { status: 500, body: { error: 'Reversal failed' } };
}

export function eventCreatedSeconds(payload) {
  const stamp = field(payload, ['timestamp']);
  if (!stamp) return null;
  const iso = stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export function parseWebhookBody(text, contentType) {
  if (!text || !String(text).trim()) return {};
  const raw = String(text);
  const type = contentType || '';
  if (type.includes('application/json') || raw.trim().startsWith('{')) {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Webhook body must be an object');
    }
    return parsed;
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

export function mergeWebhookPayload(query, body) {
  const q = query && typeof query === 'object' ? query : {};
  const b = body && typeof body === 'object' ? body : {};
  const queryType = typeof q.eventType === 'string' ? q.eventType : null;
  const bodyType = typeof b.eventType === 'string' ? b.eventType : null;
  if (queryType && bodyType && queryType !== bodyType) return { error: 'event_type_mismatch' };
  return { payload: { ...q, ...b } };
}
