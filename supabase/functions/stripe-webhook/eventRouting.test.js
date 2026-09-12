import { describe, it, expect } from 'vitest';
import {
  ACTION,
  routeEvent,
  isInquiry,
  paymentIntentId,
  reversalNotFoundAction,
  REVERSAL_RACE_WINDOW_SECONDS,
} from './eventRouting.js';

// The money path's decision layer. Until this file existed the webhook had no
// test of any kind, and four separate defects lived in these branches — each of
// them a wrong answer to a pure question. Every case below corresponds to one.

const ev = (type, object, created = 1_700_000_000) => ({ type, created, data: { object } });
const dispute = (status, pi = 'pi_1') => ({ id: 'dp_1', status, payment_intent: pi });
const charge = (refunded, captured, pi = 'pi_1') => ({
  id: 'ch_1', amount_refunded: refunded, amount_captured: captured, payment_intent: pi,
});

describe('fulfillment', () => {
  it('routes a completed checkout to fulfillment', () => {
    expect(routeEvent(ev('checkout.session.completed', { id: 'cs_1' })).action).toBe(ACTION.FULFILL);
  });
});

describe('refunds', () => {
  it('reverses a full refund', () => {
    const r = routeEvent(ev('charge.refunded', charge(999, 999)));
    expect(r).toMatchObject({ action: ACTION.REVERSE, reversalReason: 'refunded', paymentIntent: 'pi_1' });
  });

  it('leaves the gems alone on a PARTIAL refund', () => {
    expect(routeEvent(ev('charge.refunded', charge(500, 999))))
      .toMatchObject({ action: ACTION.IGNORE, ignored: 'partial_refund' });
  });

  // Compared against the CAPTURED amount, not the authorised one, so a full
  // refund of a partially captured charge still counts as full.
  it('treats a full refund of a partial capture as full', () => {
    expect(routeEvent(ev('charge.refunded', charge(500, 500))).action).toBe(ACTION.REVERSE);
  });
});

describe('disputes that took no money', () => {
  // Reversing here debits the player while the merchant keeps the payment —
  // the wrong side of the error to be on.
  it.each(['warning_needs_response', 'warning_under_review', 'warning_closed'])(
    'ignores the inquiry status %s',
    (status) => {
      expect(routeEvent(ev('charge.dispute.created', dispute(status))))
        .toMatchObject({ action: ACTION.IGNORE, ignored: 'dispute_inquiry' });
    }
  );

  it.each(['needs_response', 'under_review', 'lost', 'charge_refunded'])(
    'reverses the funds-withdrawing status %s',
    (status) => {
      expect(routeEvent(ev('charge.dispute.created', dispute(status))))
        .toMatchObject({ action: ACTION.REVERSE, reversalReason: 'disputed' });
    }
  );
});

describe('an inquiry that escalates into a real chargeback', () => {
  // Stripe reports an escalation as an UPDATE to the existing dispute, never a
  // second created. Skipping warning_* without watching updates traded one
  // money bug for its mirror image: a genuine chargeback never clawed back.
  it('reverses on charge.dispute.updated once the status leaves warning_', () => {
    expect(routeEvent(ev('charge.dispute.updated', dispute('needs_response'))))
      .toMatchObject({ action: ACTION.REVERSE, reversalReason: 'disputed' });
  });

  it('still ignores an update that is only another inquiry step', () => {
    expect(routeEvent(ev('charge.dispute.updated', dispute('warning_under_review'))))
      .toMatchObject({ action: ACTION.IGNORE, ignored: 'dispute_inquiry' });
  });
});

describe('restoration', () => {
  it('restores when a dispute is WON', () => {
    expect(routeEvent(ev('charge.dispute.closed', dispute('won'))))
      .toMatchObject({ action: ACTION.RESTORE, paymentIntent: 'pi_1' });
  });

  // A lost or accepted dispute must leave the reversal standing.
  it.each(['lost', 'warning_closed', 'under_review'])(
    'does NOT restore a dispute closed as %s',
    (status) => {
      expect(routeEvent(ev('charge.dispute.closed', dispute(status))))
        .toMatchObject({ action: ACTION.IGNORE, ignored: 'dispute_not_won' });
    }
  );

  it('restores when Stripe reinstates the funds', () => {
    expect(routeEvent(ev('charge.dispute.funds_reinstated', dispute('won'))).action)
      .toBe(ACTION.RESTORE);
  });
});

describe('payment intent normalisation', () => {
  it('accepts an id string or an expanded object', () => {
    expect(paymentIntentId('pi_abc')).toBe('pi_abc');
    expect(paymentIntentId({ id: 'pi_abc' })).toBe('pi_abc');
    expect(paymentIntentId(null)).toBeNull();
    expect(paymentIntentId(undefined)).toBeNull();
  });

  it('refuses to act when there is no payment intent to act on', () => {
    expect(routeEvent(ev('charge.refunded', charge(999, 999, null))))
      .toMatchObject({ action: ACTION.IGNORE, ignored: 'no_payment_intent' });
    expect(routeEvent(ev('charge.dispute.created', dispute('lost', null))))
      .toMatchObject({ action: ACTION.IGNORE, ignored: 'no_payment_intent' });
    expect(routeEvent(ev('charge.dispute.closed', dispute('won', null))))
      .toMatchObject({ action: ACTION.IGNORE, ignored: 'no_payment_intent' });
  });

  it('reads an expanded payment_intent object end to end', () => {
    expect(routeEvent(ev('charge.dispute.created', dispute('lost', { id: 'pi_expanded' }))))
      .toMatchObject({ action: ACTION.REVERSE, paymentIntent: 'pi_expanded' });
  });
});

describe('events this endpoint does not act on', () => {
  it.each([
    'payment_intent.succeeded',
    'customer.created',
    'invoice.paid',
    'charge.succeeded',
  ])('ignores %s', (type) => {
    expect(routeEvent(ev(type, {}))).toMatchObject({ action: ACTION.IGNORE, ignored: 'unhandled' });
  });

  it('does not throw on a malformed event', () => {
    expect(routeEvent({}).action).toBe(ACTION.IGNORE);
    expect(routeEvent(undefined).action).toBe(ACTION.IGNORE);
  });
});

describe('a reversal that arrives before its purchase', () => {
  const NOW = 1_700_000_000;

  it('asks Stripe to retry while the race is plausible', () => {
    expect(reversalNotFoundAction(NOW, NOW)).toBe('retry');
    expect(reversalNotFoundAction(NOW - 60, NOW)).toBe('retry');
    expect(reversalNotFoundAction(NOW - (REVERSAL_RACE_WINDOW_SECONDS - 1), NOW)).toBe('retry');
  });

  it('gives up once the event is too old to be a race', () => {
    expect(reversalNotFoundAction(NOW - REVERSAL_RACE_WINDOW_SECONDS, NOW)).toBe('give_up');
    expect(reversalNotFoundAction(NOW - 86_400, NOW)).toBe('give_up');
  });

  it('treats a missing created timestamp as ancient rather than retrying forever', () => {
    expect(reversalNotFoundAction(undefined, NOW)).toBe('give_up');
  });
});

describe('isInquiry', () => {
  it('is true only for warning_ statuses', () => {
    expect(isInquiry('warning_needs_response')).toBe(true);
    expect(isInquiry('needs_response')).toBe(false);
    expect(isInquiry(undefined)).toBe(false);
  });
});
