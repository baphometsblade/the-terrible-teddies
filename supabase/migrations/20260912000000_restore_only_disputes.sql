-- Narrow restore_gem_purchase to disputes only.
--
-- 20260905000000 allowed it to restore any purchase whose status was
-- 'refunded' OR 'disputed'. Those two are not symmetric, and treating them
-- alike gives the money away:
--
--   * disputed — the charge was contested. If the dispute closes in our favour
--     (charge.dispute.closed status=won, or charge.dispute.funds_reinstated)
--     Stripe returns the funds, so the gems must come back too. This is the
--     case restore exists for.
--   * refunded — we returned the money on purpose. It is never coming back, so
--     the gems must not either.
--
-- Stripe permits both on one charge: a merchant can refund a payment the
-- customer then disputes anyway, and that dispute can still close as won or
-- warning_closed. The webhook calls restore on exactly those events, keyed only
-- by payment_intent, so it would restore a purchase already marked 'refunded'.
-- Verified against postgres:16 before this migration: reverse('refunded')
-- leaves gems=0 status=refunded, and restore then returns 'restored' with
-- gems=500 — the customer holds the refund and the goods.
--
-- Everything else is unchanged: still service-role only, still idempotent (a
-- second call sees 'completed' and reports 'not_reversed'), still incapable of
-- crediting a purchase that was never reversed.
CREATE OR REPLACE FUNCTION restore_gem_purchase(
  p_payment_intent TEXT
)
RETURNS TEXT                      -- 'restored' | 'not_found' | 'not_reversed'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id      UUID;
  v_user_id UUID;
  v_gems    INTEGER;
  v_status  TEXT;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'restore_gem_purchase may only be called server-side';
  END IF;

  SELECT id, user_id, gems_granted, status
  INTO v_id, v_user_id, v_gems, v_status
  FROM purchases
  WHERE payment_intent = p_payment_intent
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- 'disputed' ONLY. A refund is deliberate and permanent.
  IF v_status <> 'disputed' THEN
    RETURN 'not_reversed';
  END IF;

  INSERT INTO user_gems (user_id, gems, total_purchased)
  VALUES (v_user_id, v_gems, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET gems       = user_gems.gems + v_gems,
        updated_at = NOW();

  UPDATE purchases
  SET status = 'completed'
  WHERE id = v_id;

  RETURN 'restored';
END;
$$;

REVOKE EXECUTE ON FUNCTION restore_gem_purchase(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION restore_gem_purchase(TEXT) TO service_role;
