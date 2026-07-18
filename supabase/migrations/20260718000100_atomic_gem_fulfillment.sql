-- Money-path correctness: make Stripe fulfillment atomic + exactly-once.
--
-- The webhook previously did two separate writes: INSERT into purchases (unique
-- on stripe_session_id), then a second RPC to credit gems. If the insert
-- succeeded but the credit failed, the handler returned 500 so Stripe retried —
-- but the retry hit the duplicate-insert branch and returned success WITHOUT
-- ever crediting the gems. Result: the customer paid and got nothing.
--
-- fulfill_gem_purchase records the purchase and credits the gems in a SINGLE
-- transaction. On a mid-way failure the whole transaction rolls back (including
-- the purchases row), so Stripe's retry re-runs it cleanly. On a genuine replay
-- of an already-fulfilled session the INSERT ... ON CONFLICT DO NOTHING makes it
-- a no-op that reports 'duplicate'. Either the purchase-and-credit both happen
-- or neither does — exactly-once.

-- Record the Stripe PaymentIntent so refund/dispute events (which carry the
-- payment_intent, not the checkout session id) can be linked back to a purchase.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS payment_intent TEXT;

CREATE INDEX IF NOT EXISTS purchases_payment_intent_idx
  ON public.purchases (payment_intent);

CREATE OR REPLACE FUNCTION fulfill_gem_purchase(
  p_user_id        UUID,
  p_bundle_id      TEXT,
  p_gems           INTEGER,
  p_session_id     TEXT,
  p_amount         INTEGER,
  p_payment_intent TEXT DEFAULT NULL
)
RETURNS TEXT               -- 'credited' on first fulfillment, 'duplicate' on replay
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  -- Only the service-role webhook (auth.uid() IS NULL) may fulfill a purchase.
  -- An authenticated caller reaching this would be minting paid currency.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'fulfill_gem_purchase may only be called server-side';
  END IF;

  IF p_gems <= 0 THEN
    RAISE EXCEPTION 'Gem amount must be positive';
  END IF;

  INSERT INTO purchases (
    user_id, bundle_id, gems_granted, stripe_session_id, amount_paid, status, payment_intent
  )
  VALUES (
    p_user_id, p_bundle_id, p_gems, p_session_id, p_amount, 'completed', p_payment_intent
  )
  ON CONFLICT (stripe_session_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;  -- 1 if newly inserted, 0 on replay
  IF v_rows = 0 THEN
    RETURN 'duplicate';
  END IF;

  -- Credit gems in the same transaction as the purchase insert.
  INSERT INTO user_gems (user_id, gems, total_purchased)
  VALUES (p_user_id, p_gems, p_gems)
  ON CONFLICT (user_id) DO UPDATE SET
    gems            = user_gems.gems + p_gems,
    total_purchased = user_gems.total_purchased + p_gems,
    updated_at      = NOW();

  RETURN 'credited';
END;
$$;

-- Only the service-role webhook may call this; never clients.
REVOKE EXECUTE ON FUNCTION fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) TO service_role;
