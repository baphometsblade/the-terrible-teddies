// Which Stripe event means what — the webhook's decision layer, extracted so it
// can be tested.
//
// Everything here is pure: it takes an event and returns what should happen to
// the gems. No network, no database, no Deno APIs, so the Vitest suite can
// import it directly even though index.ts itself is Deno + remote imports.
//
// This is the part of the money path that keeps being wrong. Four separate
// defects have lived in these few branches: disputes reversed unconditionally
// (taking gems for inquiries where Stripe withdraws nothing), no restoration at
// all when a dispute was won, restoration accepting refunds as well as disputes
// (customer keeps the money AND the goods), and the escalation from inquiry to
// real chargeback going unhandled. Every one of them is a wrong answer to a
// question with no side effects — exactly what a unit test catches, and exactly
// what no test existed for.

export const ACTION = {
  FULFILL: 'fulfill',
  RESTORE: 'restore',
  REVERSE: 'reverse',
  IGNORE: 'ignore',
};

// A PaymentIntent reference on Stripe objects can be an id string or an
// expanded object; normalize to the id stored on the purchase row.
export const paymentIntentId = (pi) =>
  typeof pi === 'string' ? pi : pi?.id ?? null;

// Dispute statuses that mean the money is currently OUT of the account, and so
// that the gems must come back.
//
// An ALLOWLIST, not "anything that is not warning_*". That denylist was the
// first version and it was wrong in the most expensive direction: `won` is not
// a warning_ status, so a dispute resolved IN OUR FAVOUR — which Stripe reports
// as a charge.dispute.updated like any other change — was routed to a reversal
// and debited the customer for winning. The asymmetry matters here. Wrongly
// debiting a paying customer is silent and lands on them; a clawback we miss is
// visible in the Stripe dashboard and recoverable. So an unrecognised future
// status does nothing rather than guessing, and charge.dispute.funds_withdrawn
// gives the genuine case a second, explicit route.
const FUNDS_WITHDRAWN_STATUSES = new Set([
  'needs_response',   // chargeback filed; Stripe has already taken the money
  'under_review',     // we responded, Stripe still holds it
  'lost',             // final, against us
  'charge_refunded',  // resolved by refunding the charge
]);

// warning_* is an inquiry or retrieval request: the issuer is asking for
// information and nothing has been withdrawn.
export const isInquiry = (status) => typeof status === 'string' && status.startsWith('warning_');

export const fundsAreWithdrawn = (status) => FUNDS_WITHDRAWN_STATUSES.has(status);

/**
 * @param {object} event a Stripe event ({type, data:{object}})
 * @returns {{action: string, ignored?: string, paymentIntent?: string, reversalReason?: string}}
 */
export function routeEvent(event) {
  const type = event?.type;
  const obj = event?.data?.object ?? {};

  if (type === 'checkout.session.completed') {
    return { action: ACTION.FULFILL };
  }

  // ── Restoration: the dispute took nothing, or we won it ──────────────────
  if (type === 'charge.dispute.funds_reinstated' || type === 'charge.dispute.closed') {
    // A dispute that closes any way but "won" — lost, or accepted by us — must
    // leave the reversal standing.
    if (type === 'charge.dispute.closed' && obj.status !== 'won') {
      return { action: ACTION.IGNORE, ignored: 'dispute_not_won' };
    }
    const paymentIntent = paymentIntentId(obj.payment_intent);
    if (!paymentIntent) return { action: ACTION.IGNORE, ignored: 'no_payment_intent' };
    return { action: ACTION.RESTORE, paymentIntent };
  }

  // ── Reversal: claw the gems back ─────────────────────────────────────────
  if (type === 'charge.refunded') {
    // Compare against the CAPTURED amount, so a full refund of a partially
    // captured charge still counts as full. A partial refund leaves the
    // purchase intact.
    // The `?? 0` defaults are a deliberate divergence from the pre-extraction
    // `charge.amount_refunded < charge.amount_captured`. With amount_refunded
    // absent, that comparison was `undefined < 999` — NaN-false — so a charge
    // event missing the field was treated as a FULL refund and debited. Reading
    // a missing field as 0 makes it a partial refund instead, and debits
    // nothing. Same principle as the dispute allowlist below: on a malformed
    // event we do not know whether the money moved, and wrongly debiting a
    // paying customer is the worse of the two errors. Not reachable in practice
    // — every Charge Stripe emits populates amount_refunded — but this is the
    // direction to fail in.
    if ((obj.amount_refunded ?? 0) < (obj.amount_captured ?? 0)) {
      return { action: ACTION.IGNORE, ignored: 'partial_refund' };
    }
    const paymentIntent = paymentIntentId(obj.payment_intent);
    if (!paymentIntent) return { action: ACTION.IGNORE, ignored: 'no_payment_intent' };
    return { action: ACTION.REVERSE, paymentIntent, reversalReason: 'refunded' };
  }

  // created AND updated: an inquiry that escalates into a real chargeback is
  // reported by Stripe as an update to the existing dispute, not a second
  // created, so watching only `created` misses every escalation.
  // funds_withdrawn is the event that says so outright, and is routed here too.
  if (
    type === 'charge.dispute.created' ||
    type === 'charge.dispute.updated' ||
    type === 'charge.dispute.funds_withdrawn'
  ) {
    if (isInquiry(obj.status)) {
      return { action: ACTION.IGNORE, ignored: 'dispute_inquiry' };
    }
    // Only reverse for a status that actually means the money is gone.
    // charge.dispute.funds_withdrawn says so by its own name, whatever status
    // the object happens to carry.
    if (type !== 'charge.dispute.funds_withdrawn' && !fundsAreWithdrawn(obj.status)) {
      return { action: ACTION.IGNORE, ignored: 'dispute_funds_not_withdrawn' };
    }
    const paymentIntent = paymentIntentId(obj.payment_intent);
    if (!paymentIntent) return { action: ACTION.IGNORE, ignored: 'no_payment_intent' };
    return { action: ACTION.REVERSE, paymentIntent, reversalReason: 'disputed' };
  }

  return { action: ACTION.IGNORE, ignored: 'unhandled' };
}

// How long a reversal whose purchase row does not exist yet is treated as a
// race with fulfillment rather than an unrelated charge.
export const REVERSAL_RACE_WINDOW_SECONDS = 3600;

/**
 * A reversal found no purchase row. Stripe does not guarantee event ordering,
 * so a refund or dispute can be delivered before the checkout.session.completed
 * that creates the row — acking there drops the reversal, and the fulfillment
 * that lands moments later credits gems for money already given back. A recent
 * event is overwhelmingly that race, so ask Stripe to retry; an old one is a
 * genuinely unrelated charge, so ack it and stop.
 *
 * @returns {'retry'|'give_up'}
 */
export function reversalNotFoundAction(eventCreatedSeconds, nowSeconds) {
  const age = nowSeconds - (eventCreatedSeconds ?? 0);
  return age < REVERSAL_RACE_WINDOW_SECONDS ? 'retry' : 'give_up';
}
