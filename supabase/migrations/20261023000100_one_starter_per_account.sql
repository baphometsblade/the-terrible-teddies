-- One Starter Gem Pack per account, including for a buyer with two checkouts
-- open at once.
--
-- create-checkout-session refuses a second Starter Gem Pack by reading the
-- account's purchases rows (wave 4), but a row only exists once a payment has
-- been fulfilled. A buyer who opened two starter checkouts before paying
-- either (two tabs, or Back to the Shop and tap again) could complete both:
-- each was created while the account held nothing, and the webhook credited
-- every paid session it was sent. Two layers close it, and either alone keeps
-- the promise that no account receives the starter twice:
--
--   1. checkout_holds: the open Checkout Session for an account's
--      one-per-account bundle. While one is open, the checkout function hands
--      back that same session's URL instead of creating a second, so a buyer
--      is not normally able to pay twice at all. Starter sessions expire after
--      about half an hour, so an abandoned one frees up quickly.
--   2. fulfill_gem_purchase refuses to credit a second one for an account that
--      already holds it, and the webhook refunds that payment in full through
--      Stripe, then records it here as 'refunded_duplicate'. This is the layer
--      that makes it airtight: whatever path produced a second paid session
--      (one created before this migration, a race, a hold lost), the buyer
--      gets either the gems or their money back, never neither and never both.

-- ---------------------------------------------------------------------------
-- The one list, in SQL. Mirrors ONE_PER_ACCOUNT_BUNDLES in
-- supabase/functions/create-checkout-session/checkoutGuards.js, and
-- checkoutGuards.test.js fails if the two drift.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.one_per_account_bundle(p_bundle_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT p_bundle_id = ANY (ARRAY['starter_bundle']);
$$;

REVOKE EXECUTE ON FUNCTION public.one_per_account_bundle(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.one_per_account_bundle(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 1. Open checkouts.
-- ---------------------------------------------------------------------------
-- One row per account and bundle: the primary key is what stops two
-- concurrent requests from both recording a session. Written only by the
-- checkout function with the service role, through the functions below; no
-- client role holds any privilege on it, and RLS is on with no policy.
CREATE TABLE IF NOT EXISTS public.checkout_holds (
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle_id         TEXT        NOT NULL,
  stripe_session_id TEXT        NOT NULL,
  checkout_url      TEXT        NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, bundle_id)
);

ALTER TABLE public.checkout_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.checkout_holds TO service_role;

-- The account's open checkout for the bundle, if its session has not passed
-- its expiry. The checkout function asks Stripe what became of it (still
-- open, paid, expired) before reusing it.
CREATE OR REPLACE FUNCTION public.get_checkout_hold(
  p_user_id   UUID,
  p_bundle_id TEXT
)
RETURNS TABLE (stripe_session_id TEXT, checkout_url TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'get_checkout_hold may only be called server-side';
  END IF;

  RETURN QUERY
    SELECT h.stripe_session_id, h.checkout_url, h.expires_at
    FROM public.checkout_holds h
    WHERE h.user_id = p_user_id
      AND h.bundle_id = p_bundle_id
      AND h.expires_at > NOW();
END;
$$;

-- Record a newly created session as the account's open checkout. It takes the
-- place only of a hold that has expired, or of the one session the caller
-- has just confirmed with Stripe is finished (p_replaces). Otherwise the hold
-- already there wins, `claimed` is false, and the caller expires the session
-- it created (whose URL it never handed out) and returns the winner's.
CREATE OR REPLACE FUNCTION public.claim_checkout_hold(
  p_user_id      UUID,
  p_bundle_id    TEXT,
  p_session_id   TEXT,
  p_checkout_url TEXT,
  p_expires_at   TIMESTAMPTZ,
  p_replaces     TEXT DEFAULT NULL
)
RETURNS TABLE (stripe_session_id TEXT, checkout_url TEXT, expires_at TIMESTAMPTZ, claimed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'claim_checkout_hold may only be called server-side';
  END IF;
  IF NOT public.one_per_account_bundle(p_bundle_id) THEN
    RAISE EXCEPTION 'claim_checkout_hold: % is not a one-per-account bundle', p_bundle_id;
  END IF;

  INSERT INTO public.checkout_holds AS h
    (user_id, bundle_id, stripe_session_id, checkout_url, expires_at)
  VALUES (p_user_id, p_bundle_id, p_session_id, p_checkout_url, p_expires_at)
  ON CONFLICT (user_id, bundle_id) DO UPDATE
    SET stripe_session_id = EXCLUDED.stripe_session_id,
        checkout_url      = EXCLUDED.checkout_url,
        expires_at        = EXCLUDED.expires_at,
        created_at        = NOW()
    WHERE h.expires_at <= NOW()
       OR (p_replaces IS NOT NULL AND h.stripe_session_id = p_replaces);

  IF FOUND THEN
    RETURN QUERY SELECT p_session_id, p_checkout_url, p_expires_at, TRUE;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT h.stripe_session_id, h.checkout_url, h.expires_at, FALSE
    FROM public.checkout_holds h
    WHERE h.user_id = p_user_id AND h.bundle_id = p_bundle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_checkout_hold(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_hold(UUID, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_checkout_hold(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_checkout_hold(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Fulfilment refuses a second one.
-- ---------------------------------------------------------------------------
-- Unchanged for every other bundle. For a one-per-account bundle, fulfilments
-- for the same account are serialised by a transaction-scoped advisory lock,
-- so two paid sessions arriving at once cannot both see "none held yet" and
-- both credit. Under READ COMMITTED the check that follows the lock takes a
-- fresh snapshot, so it sees a row the other transaction has just committed.
--
-- 'completed' and 'disputed' hold the one, as in checkoutGuards.js
-- (USES_UP_THE_ONE): a won dispute turns 'disputed' back into 'completed'.
--
-- The refusal RAISEs rather than returning a value, on purpose. A webhook
-- deployed before this migration treats any returned value as success and
-- acknowledges the event; with an exception it answers 500, Stripe keeps
-- retrying (for days), and the current webhook refunds the payment on the
-- next delivery. A webhook that does not yet know to refund can therefore
-- never leave a buyer charged with no gems and no refund. 'PT409' is
-- PostgREST's custom-status form: the RPC fails with HTTP 409 and this code,
-- which stripe-webhook/duplicateRefund.js recognises.
--
-- A replay of a session already recorded (credited, or refunded as a
-- duplicate) is still answered 'duplicate' by the ON CONFLICT below.
CREATE OR REPLACE FUNCTION fulfill_gem_purchase(
  p_user_id        UUID,
  p_bundle_id      TEXT,
  p_gems           INTEGER,
  p_session_id     TEXT,
  p_amount         INTEGER,
  p_payment_intent TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'fulfill_gem_purchase may only be called server-side';
  END IF;

  IF p_gems <= 0 THEN
    RAISE EXCEPTION 'Gem amount must be positive';
  END IF;

  IF public.one_per_account_bundle(p_bundle_id) THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('one_per_account:' || p_user_id::text || ':' || p_bundle_id, 0)
    );
    IF NOT EXISTS (SELECT 1 FROM purchases WHERE stripe_session_id = p_session_id)
       AND EXISTS (
         SELECT 1 FROM purchases
         WHERE user_id = p_user_id
           AND bundle_id = p_bundle_id
           AND status IN ('completed', 'disputed')
       )
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'PT409',
        MESSAGE = 'one_per_account_already_held',
        DETAIL  = format('%s already holds %s; session %s must be refunded, not credited',
                         p_user_id, p_bundle_id, p_session_id);
    END IF;
  END IF;

  INSERT INTO purchases (
    user_id, bundle_id, gems_granted, stripe_session_id, amount_paid, status, payment_intent
  )
  VALUES (
    p_user_id, p_bundle_id, p_gems, p_session_id, p_amount, 'completed', p_payment_intent
  )
  ON CONFLICT (stripe_session_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO user_gems (user_id, gems, total_purchased)
  VALUES (p_user_id, p_gems, p_gems)
  ON CONFLICT (user_id) DO UPDATE SET
    gems            = user_gems.gems + p_gems,
    total_purchased = user_gems.total_purchased + p_gems,
    updated_at      = NOW();

  RETURN 'credited';
END;
$$;

REVOKE EXECUTE ON FUNCTION fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) TO service_role;

-- The refunded second payment, recorded once Stripe has accepted the refund.
-- No gems move. The row is what lets the rest of the money path stay
-- correct without knowing about duplicates:
--   * a replayed checkout.session.completed finds it and answers 'duplicate';
--   * the charge.refunded Stripe sends for this very refund finds it, and
--     reverse_gem_purchase answers 'already_reversed' (it is not 'completed'),
--     instead of 'not_found', which the webhook retries for an hour;
--   * restore_gem_purchase restores only 'disputed', so this never comes back;
--   * the Shop and the checkout guard count only 'completed' and 'disputed';
--   * the purchase screen reads it and tells the buyer why they were refunded.
CREATE OR REPLACE FUNCTION public.record_refunded_duplicate(
  p_user_id        UUID,
  p_bundle_id      TEXT,
  p_gems           INTEGER,
  p_session_id     TEXT,
  p_amount         INTEGER,
  p_payment_intent TEXT
)
RETURNS TEXT                      -- 'recorded' | 'duplicate'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'record_refunded_duplicate may only be called server-side';
  END IF;

  INSERT INTO purchases (
    user_id, bundle_id, gems_granted, stripe_session_id, amount_paid, status, payment_intent
  )
  VALUES (
    p_user_id, p_bundle_id, p_gems, p_session_id, p_amount, 'refunded_duplicate', p_payment_intent
  )
  ON CONFLICT (stripe_session_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN CASE WHEN v_rows = 0 THEN 'duplicate' ELSE 'recorded' END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_refunded_duplicate(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_refunded_duplicate(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) TO service_role;
