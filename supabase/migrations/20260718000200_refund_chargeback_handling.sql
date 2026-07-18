-- Money-path: claw back gems when a payment is refunded or charged back.
--
-- add_user_gems is additive-only and user_gems.gems has CHECK (gems >= 0), so
-- before this migration a purchase could be reversed at Stripe (refund or
-- dispute) while the granted gems stayed in the account forever — buy, spend,
-- chargeback, keep the goods. reverse_gem_purchase debits the granted gems
-- (flooring at 0, since they may already be partly spent) and marks the purchase
-- so the reversal is applied at most once.

CREATE OR REPLACE FUNCTION reverse_gem_purchase(
  p_payment_intent TEXT,
  p_reason         TEXT           -- 'refunded' | 'disputed'
)
RETURNS TEXT                      -- 'reversed' | 'not_found' | 'already_reversed'
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
  -- Service-role webhook only (auth.uid() IS NULL); never a client.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'reverse_gem_purchase may only be called server-side';
  END IF;

  -- Lock the purchase row so concurrent refund+dispute events can't double-debit.
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

  -- Idempotent: only a still-completed purchase gets reversed.
  IF v_status <> 'completed' THEN
    RETURN 'already_reversed';
  END IF;

  UPDATE user_gems
  SET gems       = GREATEST(gems - v_gems, 0),
      updated_at = NOW()
  WHERE user_id = v_user_id;

  -- Mark exactly the row we locked and debited (payment_intent is 1:1 with a
  -- purchase, but scope the update to the locked id to keep it unambiguous).
  UPDATE purchases
  SET status = p_reason
  WHERE id = v_id;

  RETURN 'reversed';
END;
$$;

REVOKE EXECUTE ON FUNCTION reverse_gem_purchase(TEXT, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION reverse_gem_purchase(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION reverse_gem_purchase(TEXT, TEXT) TO service_role;

-- Leaderboard: the app gates all content behind auth, so nothing legitimately
-- reads the board unauthenticated. Drop the anon grant to stop anon-key scraping
-- of the top-100 usernames; authenticated clients are unaffected.
REVOKE SELECT ON public.leaderboard FROM anon;
