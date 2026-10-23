// A second paid one-per-account bundle (the Starter Gem Pack): the webhook's
// decisions about refunding it, extracted as pure JS for the same reason as
// eventRouting.js — there is no Deno in CI, and this is money.
//
// fulfill_gem_purchase (20261023000100) refuses to credit a starter for an
// account that already holds one, by raising SQLSTATE PT409, which PostgREST
// turns into an HTTP 409 carrying that code. The webhook then refunds the
// payment in full through Stripe and records it ('refunded_duplicate'). The
// buyer ends up with the gems once or with their money back, never neither.
//
// The order is refund first, record second. Each step failing answers 500,
// so Stripe redelivers the event and the next delivery starts again from the
// refusal: the refund carries an idempotency key (and a refund Stripe already
// made is recognised below), and recording is idempotent on the session id.

import { paymentIntentId } from './eventRouting.js';

export const ONE_PER_ACCOUNT_REFUSAL_CODE = 'PT409';
export const ONE_PER_ACCOUNT_REFUSAL_MESSAGE = 'one_per_account_already_held';

/**
 * Whether fulfill_gem_purchase's error is the one-per-account refusal (refund
 * the payment) rather than a failure (answer 500 so Stripe retries). Both the
 * code and the message must match: PT409 alone is only "an HTTP 409".
 */
export function isOnePerAccountRefusal(rpcError) {
  return rpcError?.code === ONE_PER_ACCOUNT_REFUSAL_CODE
    && typeof rpcError.message === 'string'
    && rpcError.message.includes(ONE_PER_ACCOUNT_REFUSAL_MESSAGE);
}

/**
 * The Stripe refund for a refused second purchase: the whole payment, keyed
 * so a redelivered event cannot refund twice. Null when the session names no
 * PaymentIntent, which a paid payment-mode session always does; the caller
 * then answers 500, leaving the payment visible in Stripe's dashboard.
 *
 * @returns {{params: object, options: {idempotencyKey: string}} | null}
 */
export function duplicateRefundRequest(session, { userId, bundleId }) {
  const paymentIntent = paymentIntentId(session?.payment_intent);
  if (!paymentIntent || !session?.id) return null;
  return {
    params: {
      payment_intent: paymentIntent,
      reason: 'duplicate',
      metadata: {
        reason: 'one_per_account',
        bundle_id: bundleId,
        user_id: userId,
        checkout_session_id: session.id,
      },
    },
    options: { idempotencyKey: `one-per-account-refund:${session.id}` },
  };
}

/**
 * Whether a failed refund call means the money has already gone back. An
 * idempotency key lasts 24 hours, and Stripe keeps redelivering an event for
 * up to three days, so a late redelivery can meet a charge refunded by an
 * earlier one. That is the outcome wanted, not a failure.
 */
export function refundAlreadyMade(err) {
  const code = err?.code ?? err?.raw?.code;
  return code === 'charge_already_refunded';
}
