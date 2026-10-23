import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  isOnePerAccountRefusal, duplicateRefundRequest, refundAlreadyMade,
  ONE_PER_ACCOUNT_REFUSAL_CODE, ONE_PER_ACCOUNT_REFUSAL_MESSAGE,
} from './duplicateRefund.js';

// By repo path, like gemBundles.test.js: under jsdom import.meta.url is not a file URL.
const INDEX_TS = resolve(process.cwd(), 'supabase/functions/stripe-webhook/index.ts');
const MIGRATION = resolve(process.cwd(), 'supabase/migrations/20261023000100_one_starter_per_account.sql');

const SESSION = { id: 'cs_second', payment_intent: 'pi_second', amount_total: 499 };
const WHO = { userId: '11111111-1111-4111-8111-111111111111', bundleId: 'starter_bundle' };

// A second paid Starter Gem Pack for an account: fulfill_gem_purchase raises
// PT409, and the webhook refunds instead of answering 500 forever (the
// payment would then sit in Stripe, charged, with no gems and no refund).
describe('the one-per-account refusal', () => {
  // As supabase-js hands back PostgREST's error for RAISE ... ERRCODE 'PT409'.
  const refusal = {
    code: 'PT409',
    message: 'one_per_account_already_held',
    details: '11111111-… already holds starter_bundle; session cs_second must be refunded, not credited',
    hint: null,
  };

  it('is recognised by its code and message together', () => {
    expect(isOnePerAccountRefusal(refusal)).toBe(true);
  });

  // Anything else is a failure: answer 500 so Stripe retries, never refund.
  // Refunding on a transient error would give back money for gems that a
  // retry was about to credit.
  it('is not confused with a failure that must be retried', () => {
    expect(isOnePerAccountRefusal(null)).toBe(false);
    expect(isOnePerAccountRefusal(undefined)).toBe(false);
    expect(isOnePerAccountRefusal({ code: 'PT409', message: 'some other conflict' })).toBe(false);
    expect(isOnePerAccountRefusal({ code: 'P0001', message: 'one_per_account_already_held' })).toBe(false);
    expect(isOnePerAccountRefusal({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false);
    expect(isOnePerAccountRefusal({ message: 'FetchError: network down' })).toBe(false);
  });

  it('matches what the migration raises', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toContain(`ERRCODE = '${ONE_PER_ACCOUNT_REFUSAL_CODE}'`);
    expect(sql).toContain(`MESSAGE = '${ONE_PER_ACCOUNT_REFUSAL_MESSAGE}'`);
  });
});

describe('the refund', () => {
  it('returns the whole payment, keyed by the session so a redelivery cannot refund twice', () => {
    expect(duplicateRefundRequest(SESSION, WHO)).toEqual({
      params: {
        payment_intent: 'pi_second',
        reason: 'duplicate',
        metadata: {
          reason: 'one_per_account',
          bundle_id: 'starter_bundle',
          user_id: WHO.userId,
          checkout_session_id: 'cs_second',
        },
      },
      options: { idempotencyKey: 'one-per-account-refund:cs_second' },
    });
    // No amount: Stripe refunds the full charge. A partial refund would leave
    // the buyer charged for gems they never got.
    expect(duplicateRefundRequest(SESSION, WHO).params).not.toHaveProperty('amount');
  });

  it('takes the PaymentIntent from an expanded object too', () => {
    const req = duplicateRefundRequest({ ...SESSION, payment_intent: { id: 'pi_expanded' } }, WHO);
    expect(req.params.payment_intent).toBe('pi_expanded');
  });

  it('cannot be built without a PaymentIntent, so the caller answers 500 rather than acking', () => {
    expect(duplicateRefundRequest({ ...SESSION, payment_intent: null }, WHO)).toBeNull();
    expect(duplicateRefundRequest({ id: 'cs_x' }, WHO)).toBeNull();
    expect(duplicateRefundRequest(null, WHO)).toBeNull();
  });

  // Idempotency keys last a day; Stripe redelivers for three. A late
  // redelivery meets a charge already refunded, which is the goal reached.
  it('treats "already refunded" as done, and every other error as a failure', () => {
    expect(refundAlreadyMade({ code: 'charge_already_refunded' })).toBe(true);
    expect(refundAlreadyMade({ raw: { code: 'charge_already_refunded' } })).toBe(true);
    expect(refundAlreadyMade({ code: 'rate_limit' })).toBe(false);
    expect(refundAlreadyMade({ type: 'StripeConnectionError' })).toBe(false);
    expect(refundAlreadyMade(new Error('socket hang up'))).toBe(false);
    expect(refundAlreadyMade(undefined)).toBe(false);
  });
});

describe('the webhook wiring', () => {
  // No Deno in CI, so the order of the calls is pinned in the source.
  const source = readFileSync(INDEX_TS, 'utf8');

  it('refunds on the refusal, before treating other errors as failures', () => {
    const fulfil = source.indexOf('"fulfill_gem_purchase"');
    const refusal = source.indexOf('isOnePerAccountRefusal(rpcError)');
    const failure = source.indexOf('console.error("Fulfillment failed:"');
    expect(fulfil).toBeGreaterThan(-1);
    expect(refusal).toBeGreaterThan(fulfil);
    expect(refusal).toBeLessThan(failure);
  });

  it('refunds through Stripe first and records it after, with an idempotency key', () => {
    const body = source.slice(source.indexOf('async function refundDuplicate'));
    const refund = body.indexOf('stripe.refunds.create(request.params');
    const record = body.indexOf('"record_refunded_duplicate"');
    expect(refund).toBeGreaterThan(-1);
    expect(record).toBeGreaterThan(refund);
    expect(body.slice(refund, refund + 120)).toContain('request.options');
    expect(body).toContain('refundAlreadyMade(err)');
  });
});
