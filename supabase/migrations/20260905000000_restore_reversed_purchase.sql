-- Give a reversal a way back.
--
-- reverse_gem_purchase (20260718000200) is one-way: it debits the granted gems
-- and stamps purchases.status. That is correct for a lost chargeback, but the
-- webhook calls it on EVERY charge.dispute.created, and not every dispute takes
-- the money:
--
--   * An inquiry / retrieval request is created with status warning_needs_response
--     (then warning_under_review, warning_closed). Stripe withdraws nothing; the
--     issuer is only asking for information. Today the player's gems are debited
--     anyway, while the merchant keeps the payment.
--   * A genuine dispute the merchant WINS is reinstated — Stripe emits
--     charge.dispute.closed with status "won", and charge.dispute.funds_reinstated.
--     Neither event was handled, so the debit stood permanently.
--
-- In both cases the paying customer ends up short with no route back: replaying
-- checkout.session.completed cannot repair it either, because
-- fulfill_gem_purchase's INSERT ... ON CONFLICT (stripe_session_id) DO NOTHING
-- finds the existing row and returns 'duplicate' BEFORE reaching the credit.
--
-- restore_gem_purchase is the inverse: re-credit exactly what was reversed and
-- put the purchase back to 'completed'. It restores ONLY a purchase that is
-- currently reversed, so it can never mint gems for a purchase that was never
-- debited, and it is idempotent — a second call finds status 'completed' and
-- reports 'not_reversed' rather than crediting again.
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

  -- Lock the row, exactly as the reversal does, so a dispute closing while a
  -- refund event is in flight cannot double-credit.
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

  -- Only a reversed purchase may be restored. Anything else — already
  -- completed, or a status this function does not know — is left untouched.
  IF v_status NOT IN ('refunded', 'disputed') THEN
    RETURN 'not_reversed';
  END IF;

  -- Mirrors the reversal's UPSERT shape: the user_gems row always exists by
  -- this point (fulfillment created it), but an INSERT ... ON CONFLICT keeps
  -- this safe if it was ever removed.
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

REVOKE EXECUTE ON FUNCTION restore_gem_purchase(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION restore_gem_purchase(TEXT) TO service_role;
