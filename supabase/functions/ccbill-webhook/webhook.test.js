// CCBill's response digest, from the Dynamic Pricing guide: an approval is
// MD5(subscriptionId + "1" + salt) and a denial is MD5(denialId + "0" + salt).
// Webhooks name the same value dynamicPricingValidationDigest or responseDigest.
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { approvalDigest, denialDigest } from '../ccbill-checkout/flexforms.js';
import { ACTION } from './webhook.js';
import {
  verifyResponseDigest, authenticateWebhook, routeEvent, saleCredit,
  fulfillmentSuccessResponse, fulfillmentErrorResponse, reversalResponse,
  parseWebhookIps, ipAllowed, clientIpFromHeaders, mergeWebhookPayload,
  CCBILL_PUBLISHED_WEBHOOK_RANGES, priceToCents,
} from './webhook.js';

const SALT = 'qwertyasdfgzxcvbnhyujm';
const SUB = '0913022401000012345';
const USER = '11111111-1111-4111-8111-111111111111';
const BUNDLES = {
  gems_large: { gems: 500, bonus: 50, price: 999 },
  starter_bundle: { gems: 300, bonus: 0, price: 499 },
};

const sale = (over = {}) => ({
  eventType: 'NewSaleSuccess',
  subscriptionId: SUB,
  transactionId: 'txn-100',
  billedInitialPrice: '9.99',
  billedCurrencyCode: '840',
  'X-userId': USER,
  'X-bundleId': 'gems_large',
  dynamicPricingValidationDigest: approvalDigest(SUB, SALT),
  timestamp: '2026-11-07 02:00:00',
  ...over,
});

describe('response digest', () => {
  it('accepts an approval digest MD5(subscriptionId + 1 + salt)', () => {
    expect(approvalDigest(SUB, SALT)).toMatch(/^[0-9a-f]{32}$/);
    expect(verifyResponseDigest(sale(), SALT)).toBe(true);
  });

  it('accepts the same digest under the responseDigest name', () => {
    const { dynamicPricingValidationDigest, ...rest } = sale();
    expect(verifyResponseDigest({ ...rest, responseDigest: dynamicPricingValidationDigest }, SALT)).toBe(true);
  });

  it('rejects a missing, truncated, or wrong digest', () => {
    const { dynamicPricingValidationDigest: _ignored, ...rest } = sale();
    expect(verifyResponseDigest(rest, SALT)).toBe(false);
    expect(verifyResponseDigest({ ...rest, dynamicPricingValidationDigest: 'abcd' }, SALT)).toBe(false);
    expect(verifyResponseDigest({ ...rest, dynamicPricingValidationDigest: approvalDigest(SUB, 'other') }, SALT)).toBe(false);
    expect(verifyResponseDigest(sale(), '')).toBe(false);
  });

  it('verifies a denial as MD5(denialId + 0 + salt), not the approval formula', () => {
    const denialId = 'deny-77';
    const failure = {
      eventType: 'NewSaleFailure',
      denialId,
      subscriptionId: SUB,
      transactionId: 'txn-fail',
      dynamicPricingValidationDigest: denialDigest(denialId, SALT),
    };
    expect(verifyResponseDigest(failure, SALT)).toBe(true);
    expect(verifyResponseDigest({
      ...failure,
      dynamicPricingValidationDigest: approvalDigest(SUB, SALT),
    }, SALT)).toBe(false);
  });

  it('compares hex case-insensitively and rejects a non-hex string of the right length', () => {
    const digest = approvalDigest(SUB, SALT).toUpperCase();
    expect(verifyResponseDigest(sale({ dynamicPricingValidationDigest: digest }), SALT)).toBe(true);
    expect(verifyResponseDigest(sale({ dynamicPricingValidationDigest: 'g'.repeat(32) }), SALT)).toBe(false);
  });
});

describe('IP allowlist', () => {
  it('is optional: an unset or blank list allows every source', () => {
    expect(parseWebhookIps(undefined)).toBeNull();
    expect(parseWebhookIps('')).toBeNull();
    expect(parseWebhookIps('  ')).toBeNull();
    expect(ipAllowed('1.2.3.4', null)).toBe(true);
    expect(ipAllowed(null, null)).toBe(true);
  });

  it('matches CCBill\'s published ranges and rejects everyone else, including a missing address', () => {
    const list = parseWebhookIps(CCBILL_PUBLISHED_WEBHOOK_RANGES.join(','));
    expect(CCBILL_PUBLISHED_WEBHOOK_RANGES).toEqual([
      '64.38.212.0/24',
      '64.38.215.0/24',
      '64.38.240.0/24',
      '64.38.241.0/24',
    ]);
    expect(ipAllowed('64.38.212.10', list)).toBe(true);
    expect(ipAllowed('64.38.215.255', list)).toBe(true);
    expect(ipAllowed('64.38.240.0', list)).toBe(true);
    expect(ipAllowed('64.38.241.1', list)).toBe(true);
    expect(ipAllowed('64.38.213.10', list)).toBe(false);
    expect(ipAllowed('8.8.8.8', list)).toBe(false);
    expect(ipAllowed(null, list)).toBe(false);
    expect(ipAllowed('64.38.212.10', parseWebhookIps('64.38.212.10'))).toBe(true);
  });

  it('reads the proxy address, not a client-supplied earlier hop', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 64.38.212.10' });
    expect(clientIpFromHeaders(headers)).toBe('64.38.212.10');
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '64.38.215.8', 'x-forwarded-for': '1.1.1.1' }))).toBe('64.38.215.8');
  });
});

describe('authenticateWebhook', () => {
  it('requires the digest, and the allowlist only when one is configured', () => {
    expect(authenticateWebhook(sale(), { salt: SALT, allowlist: null, ip: '8.8.8.8' }).ok).toBe(true);
    const list = parseWebhookIps(CCBILL_PUBLISHED_WEBHOOK_RANGES.join(','));
    expect(authenticateWebhook(sale(), { salt: SALT, allowlist: list, ip: '64.38.212.10' }).ok).toBe(true);
    expect(authenticateWebhook(sale(), { salt: SALT, allowlist: list, ip: '8.8.8.8' })).toMatchObject({ ok: false, status: 403 });
    const { dynamicPricingValidationDigest: _ignored, ...rest } = sale();
    expect(authenticateWebhook(rest, { salt: SALT, allowlist: null, ip: '64.38.212.10' })).toMatchObject({ ok: false, status: 400 });
  });
});

describe('event routing', () => {
  it('credits a NewSaleSuccess and ignores a failure or an unknown event', () => {
    expect(routeEvent(sale()).action).toBe(ACTION.FULFILL);
    expect(routeEvent({ eventType: 'NewSaleFailure', denialId: 'd' }).action).toBe(ACTION.IGNORE);
    expect(routeEvent({ eventType: 'RenewalSuccess' })).toMatchObject({ action: ACTION.IGNORE, ignored: 'unhandled' });
    expect(routeEvent({})).toMatchObject({ action: ACTION.IGNORE, ignored: 'unhandled' });
  });

  it('claws back a full refund, a chargeback and a void, and leaves a partial refund', () => {
    const refund = {
      eventType: 'Refund',
      subscriptionId: SUB,
      billedInitialPrice: '9.99',
      billedAmount: '9.99',
      billedCurrencyCode: '840',
    };
    expect(routeEvent(refund)).toEqual({ action: ACTION.REVERSE, paymentIntent: SUB, reversalReason: 'refunded' });
    expect(routeEvent({ ...refund, billedAmount: '1.00' })).toMatchObject({ action: ACTION.IGNORE, ignored: 'partial_refund' });
    expect(routeEvent({ eventType: 'Refund', subscriptionId: SUB })).toMatchObject({ action: ACTION.IGNORE, ignored: 'refund_amount_unknown' });
    expect(routeEvent({ eventType: 'Chargeback', subscriptionId: SUB })).toEqual({
      action: ACTION.REVERSE, paymentIntent: SUB, reversalReason: 'disputed',
    });
    expect(routeEvent({ eventType: 'Void', subscriptionId: SUB })).toEqual({
      action: ACTION.REVERSE, paymentIntent: SUB, reversalReason: 'refunded',
    });
    expect(routeEvent({ eventType: 'Chargeback' })).toMatchObject({ action: ACTION.IGNORE, ignored: 'no_subscription' });
  });

  it('does not claw back a refund in another currency', () => {
    expect(routeEvent({
      eventType: 'Refund',
      subscriptionId: SUB,
      billedInitialPrice: '9.99',
      billedAmount: '9.99',
      billedCurrencyCode: '978',
    })).toMatchObject({ action: ACTION.IGNORE, ignored: 'currency_mismatch' });
  });
});

describe('crediting', () => {
  it('checks the billed amount and currency against the bundle before naming a credit', () => {
    const credit = saleCredit(sale(), BUNDLES);
    expect(credit.ok).toBe(true);
    expect(credit.rpc).toEqual({
      p_user_id: USER,
      p_bundle_id: 'gems_large',
      p_gems: 550,
      p_session_id: 'txn-100',
      p_amount: 999,
      p_payment_intent: SUB,
    });
    expect(saleCredit(sale({ billedInitialPrice: '1.00' }), BUNDLES)).toMatchObject({ ok: false, error: 'Amount mismatch' });
    expect(saleCredit(sale({ billedCurrencyCode: '978' }), BUNDLES)).toMatchObject({ ok: false, error: 'Currency mismatch' });
    expect(saleCredit(sale({ billedCurrencyCode: 'USD' }), BUNDLES).ok).toBe(true);
    expect(saleCredit(sale({ 'X-bundleId': 'nope' }), BUNDLES)).toMatchObject({ ok: false, error: 'Unknown bundle' });
    expect(saleCredit(sale({ 'X-userId': 'not-a-uuid' }), BUNDLES)).toMatchObject({ ok: false, error: 'Invalid user binding' });
  });

  it('reads the custom fields CCBill echoes with or without the X- prefix', () => {
    const echoed = sale();
    delete echoed['X-userId'];
    delete echoed['X-bundleId'];
    echoed.userId = USER;
    echoed.bundleId = 'gems_large';
    expect(saleCredit(echoed, BUNDLES).ok).toBe(true);
  });

  it('keys the credit on the transaction id, so a redelivery is the same purchase', () => {
    const first = saleCredit(sale(), BUNDLES);
    const again = saleCredit(sale(), BUNDLES);
    expect(again.rpc.p_session_id).toBe(first.rpc.p_session_id);
    expect(again.rpc.p_session_id).toBe('txn-100');
    expect(fulfillmentSuccessResponse('credited')).toMatchObject({ status: 200, body: { outcome: 'credited' } });
    expect(fulfillmentSuccessResponse('duplicate')).toMatchObject({ status: 200, body: { outcome: 'duplicate' } });
  });

  it('does not credit a second one-per-account sale, and does not pretend it was refunded', () => {
    const refusal = { code: 'PT409', message: 'one_per_account_already_held' };
    const decision = fulfillmentErrorResponse(refusal);
    expect(decision).toEqual({ status: 500, outcome: 'one_per_account_refund_required', credited: false });
    expect(fulfillmentErrorResponse({ code: 'PT409', message: 'something else' }).outcome).toBe('fulfillment_failed');
  });

  it('parses CCBill decimal amounts as cents', () => {
    expect(priceToCents('9.99')).toBe(999);
    expect(priceToCents('0.99')).toBe(99);
    expect(priceToCents('10')).toBe(1000);
    expect(priceToCents('10.9')).toBe(1090);
    expect(priceToCents('10.999')).toBeNull();
    expect(priceToCents('')).toBeNull();
  });
});

describe('refund clawback idempotency', () => {
  const now = 1_700_000_000;

  it('acks a reversal that already happened and asks for a retry when the purchase is not there yet', () => {
    expect(reversalResponse('reversed', now, now)).toMatchObject({ status: 200, body: { outcome: 'reversed' } });
    expect(reversalResponse('already_reversed', now, now)).toMatchObject({ status: 200, body: { outcome: 'already_reversed' } });
    expect(reversalResponse('not_found', now - 10, now)).toMatchObject({ status: 409 });
    expect(reversalResponse('not_found', now - 7200, now)).toMatchObject({ status: 200, body: { outcome: 'not_found' } });
  });
});

describe('payload shape', () => {
  it('merges a query event type with a JSON or form body, and refuses a contradiction', () => {
    expect(mergeWebhookPayload({ eventType: 'NewSaleSuccess' }, { transactionId: 't' }).payload).toEqual({
      eventType: 'NewSaleSuccess', transactionId: 't',
    });
    expect(mergeWebhookPayload({ eventType: 'Refund' }, { eventType: 'NewSaleSuccess' }).error).toBe('event_type_mismatch');
  });
});

describe('the webhook function uses this decision layer', () => {
  const source = readFileSync(resolve(process.cwd(), 'supabase/functions/ccbill-webhook/index.ts'), 'utf8');

  it('authenticates, then credits or claws back through the existing RPCs', () => {
    const auth = source.indexOf('authenticateWebhook(');
    const route = source.indexOf('routeEvent(');
    const credit = source.indexOf('"fulfill_gem_purchase"');
    const reverse = source.indexOf('"reverse_gem_purchase"');
    expect(auth).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(route);
    expect(route).toBeLessThan(credit);
    expect(credit).toBeLessThan(reverse);
    expect(source).toMatch(/saleCredit\(/);
    expect(source).toMatch(/fulfillmentSuccessResponse\(/);
    expect(source).toMatch(/fulfillmentErrorResponse\(/);
    expect(source).toMatch(/reversalResponse\(/);
    expect(source).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).not.toMatch(/record_refunded_duplicate/);
  });
});
