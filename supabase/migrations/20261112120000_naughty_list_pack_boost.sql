-- The Naughty List boost, applied where the cards are actually rolled.
--
-- 20261110150000_card_seasons stores pack_weight_boost = 3 on the season
-- row, and the client's weightedRows() already shows that weight, but
-- settle_pack_open picked a card inside the rolled rarity with a flat
-- ORDER BY random(). An in-season xm- card was exactly as likely as any
-- evergreen card of its rarity. This file moves the pick into one helper
-- and weights it the way src/lib/packRoll.js does:
--
--   * rarity odds are unchanged (pack_odds decides the rarity first);
--   * inside that rarity a card weighs 1, or its season's
--     pack_weight_boost while starts_at <= now() < ends_at;
--   * a card named by a season that is not open weighs 0, which is the
--     same pool pack_card_in_pool() has always kept (closed-season cards
--     never roll).
--
-- The roll stays on the server, inside settle_pack_open, and the receipt
-- for a nonce still replays the same cards, so a retry cannot reroll.
-- The clock is pg_catalog.now(), read once per open. Clients cannot call
-- the helpers, so nobody can pass in a clock and open a season early.
--
-- The pick is a weighted random choice by exponential keys
-- (Efraimidis-Spirakis): the row with the smallest -ln(U)/w wins, which
-- picks each row with probability w / sum(w) in one pass.
-- 1 - random() is in (0, 1], so ln() never sees zero.
--
-- Safe to run twice: CREATE OR REPLACE only, and the grants are restated.

CREATE OR REPLACE FUNCTION public.pack_card_weight(p_id TEXT, p_at TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.card_seasons s
      WHERE p_id = ANY (s.card_ids)
        AND NOT (p_at >= s.starts_at AND p_at < s.ends_at)
    ) THEN 0::NUMERIC
    ELSE COALESCE((
      SELECT pg_catalog.max(s.pack_weight_boost) FROM public.card_seasons s
      WHERE p_id = ANY (s.card_ids)
        AND p_at >= s.starts_at AND p_at < s.ends_at
    ), 1::NUMERIC)
  END;
$$;

-- NULL rarity means any rarity: the fallback when a rarity has no card in
-- the pool. Returns NULL when nothing can be rolled.
CREATE OR REPLACE FUNCTION public.pack_pick_card(p_rarity TEXT, p_at TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT w.id
  FROM (
    SELECT c.id, public.pack_card_weight(c.id, p_at) AS weight
    FROM public.pack_catalog c
    WHERE p_rarity IS NULL OR c.rarity = p_rarity
  ) w
  WHERE w.weight > 0
  ORDER BY -pg_catalog.ln(1.0::DOUBLE PRECISION - pg_catalog.random()) / w.weight::DOUBLE PRECISION
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.pack_card_weight(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pack_pick_card(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.settle_pack_open(p_nonce TEXT, p_source TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_coins   INTEGER := 0;
  v_pity    INTEGER;
  v_opens   INTEGER;
  v_sold    INTEGER;
  v_wins    INTEGER;
  v_day     DATE;
  v_size    INTEGER;
  v_total   INTEGER;
  v_roll    INTEGER;
  v_edge    INTEGER;
  v_weight  INTEGER;
  v_rarity  TEXT;
  v_id      TEXT;
  v_full    INTEGER;
  v_room    INTEGER;
  v_pay     INTEGER;
  v_have    INTEGER;
  v_catalog INTEGER;
  v_cap     INTEGER;
  v_steps   INTEGER;
  v_rare    BOOLEAN := FALSE;
  v_ids     TEXT[] := ARRAY[]::TEXT[];
  v_kept    TEXT[] := ARRAY[]::TEXT[];
  v_seen    TEXT[] := ARRAY[]::TEXT[];
  v_i       INTEGER;
  v_now     TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_nonce IS NULL OR char_length(p_nonce) < 4 OR char_length(p_nonce) > 80 THEN
    RAISE EXCEPTION 'bad nonce' USING ERRCODE = '22023';
  END IF;
  IF p_source NOT IN ('regular', 'premium', 'legendary') THEN
    RAISE EXCEPTION 'bad pack' USING ERRCODE = '22023';
  END IF;

  SELECT coins, card_ids, kept_ids INTO v_coins, v_ids, v_kept
  FROM public.pack_receipts WHERE user_id = v_uid AND nonce = p_nonce;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'coins', v_coins, 'card_ids', COALESCE(v_ids, ARRAY[]::TEXT[]),
      'kept_ids', COALESCE(v_kept, ARRAY[]::TEXT[]), 'replay', true
    );
  END IF;

  IF NOT public.check_rate_limit('pack_open') THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = 'PT429';
  END IF;

  v_size := CASE WHEN p_source = 'legendary' THEN 10 ELSE 5 END;
  SELECT COALESCE(SUM(weight), 0) INTO v_total FROM public.pack_odds;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'odds are empty' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pack_wallet (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT pity, opens, sellback_coins, sellback_day, wins
    INTO v_pity, v_opens, v_sold, v_day, v_wins
  FROM public.pack_wallet WHERE user_id = v_uid FOR UPDATE;

  IF v_day IS DISTINCT FROM (pg_catalog.now() AT TIME ZONE 'utc')::date THEN
    v_sold := 0;
    v_day := (pg_catalog.now() AT TIME ZONE 'utc')::date;
  END IF;

  v_ids := ARRAY[]::TEXT[];
  v_kept := ARRAY[]::TEXT[];
  v_seen := ARRAY[]::TEXT[];
  FOR v_i IN 1..v_size LOOP
    v_roll := pg_catalog.floor(pg_catalog.random() * v_total)::INTEGER;
    v_edge := 0;
    v_rarity := 'common';
    FOR v_rarity, v_weight IN
      SELECT rarity, weight FROM public.pack_odds
      ORDER BY CASE rarity
        WHEN 'legendary' THEN 1 WHEN 'epic' THEN 2 WHEN 'rare' THEN 3
        WHEN 'uncommon' THEN 4 ELSE 5 END
    LOOP
      v_edge := v_edge + v_weight;
      EXIT WHEN v_roll < v_edge;
    END LOOP;
    v_id := public.pack_pick_card(v_rarity, v_now);
    IF v_id IS NULL THEN
      v_id := public.pack_pick_card(NULL, v_now);
    END IF;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'no card of that rarity' USING ERRCODE = '22023';
    END IF;
    v_ids := v_ids || v_id;
    IF v_rarity IN ('rare', 'epic', 'legendary') THEN v_rare := TRUE; END IF;
  END LOOP;

  IF NOT v_rare AND v_pity + 1 >= 10 THEN
    v_id := public.pack_pick_card('rare', v_now);
    IF v_id IS NOT NULL THEN
      v_ids[v_size] := v_id;
      v_pity := 0;
    END IF;
  ELSIF v_rare THEN
    v_pity := 0;
  ELSE
    v_pity := v_pity + 1;
  END IF;

  SELECT count(*) INTO v_catalog FROM public.pack_catalog;
  v_steps := CASE
    WHEN v_wins >= 100 THEN 3
    WHEN v_wins >= 50 THEN 2
    WHEN v_wins >= 20 THEN 1
    ELSE 0
  END;
  v_cap := LEAST(v_catalog, 36 + ((GREATEST(v_catalog - 36, 0) * v_steps) / 3));
  IF EXISTS (
    SELECT 1 FROM public.convenience_unlocks WHERE user_id = v_uid AND storage
  ) THEN
    v_cap := v_catalog;
  END IF;
  SELECT count(*) INTO v_have FROM public.pack_owned WHERE user_id = v_uid;

  v_coins := 0;
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT rarity INTO v_rarity FROM public.pack_catalog WHERE id = v_id;
    v_full := CASE v_rarity
      WHEN 'common' THEN 15
      WHEN 'uncommon' THEN 30
      WHEN 'rare' THEN 59
      WHEN 'epic' THEN 100
      ELSE 219
    END;
    IF v_id = ANY(v_seen) OR EXISTS (
      SELECT 1 FROM public.pack_owned WHERE user_id = v_uid AND card_id = v_id
    ) OR v_have >= v_cap THEN
      v_room := CASE WHEN 1700 - v_sold > 0 THEN 1700 - v_sold ELSE 0 END;
      IF v_full <= v_room THEN
        v_pay := v_full;
      ELSE
        v_pay := v_room + ((v_full - v_room) / 2);
      END IF;
      v_coins := v_coins + v_pay;
      v_sold := v_sold + v_full;
    ELSE
      INSERT INTO public.pack_owned (user_id, card_id) VALUES (v_uid, v_id);
      v_kept := v_kept || v_id;
      v_have := v_have + 1;
    END IF;
    v_seen := v_seen || v_id;
  END LOOP;

  v_opens := v_opens + 1;
  IF v_opens % 6 = 0 THEN v_coins := v_coins + 72; END IF;

  UPDATE public.pack_wallet
     SET pity = v_pity, opens = v_opens, sellback_coins = v_sold, sellback_day = v_day
   WHERE user_id = v_uid;
  INSERT INTO public.pack_receipts (user_id, nonce, coins, card_ids, kept_ids)
  VALUES (v_uid, p_nonce, v_coins, v_ids, v_kept);
  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'coins', v_coins, 'card_ids', v_ids, 'kept_ids', v_kept,
    'pity', v_pity, 'replay', false
  );
END;
$$;

ALTER FUNCTION public.settle_pack_open(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.settle_pack_open(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_pack_open(TEXT, TEXT) TO authenticated;
