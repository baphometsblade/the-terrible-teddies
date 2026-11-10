-- Pack economy. One odds table, one pity, one sell-back, whether the
-- pack was bought with earned coins or with gems. Gems spend on time
-- (buy_convenience), never on a better card and never back into cash.
-- Idempotent. One transaction.

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_action_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_max          INTEGER;
  v_window       INTEGER;
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
  v_cutoff       TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  CASE p_action_type
    WHEN 'checkout'      THEN v_max := 5;  v_window := 60;
    WHEN 'battle_result' THEN v_max := 5;  v_window := 60;
    WHEN 'level_sync'    THEN v_max := 5;  v_window := 60;
    WHEN 'admin_stats'   THEN v_max := 30; v_window := 60;
    WHEN 'activity_ping' THEN v_max := 12; v_window := 60;
    WHEN 'match_log'     THEN v_max := 30; v_window := 60;
    WHEN 'data_export'   THEN v_max := 3;  v_window := 3600;
    WHEN 'data_delete'   THEN v_max := 2;  v_window := 86400;
    WHEN 'pack_open'     THEN v_max := 30; v_window := 60;
    WHEN 'convenience'   THEN v_max := 20; v_window := 60;
    ELSE RAISE EXCEPTION 'Unknown rate limit action: %', pg_catalog.left(COALESCE(p_action_type, '<null>'::text), 40);
  END CASE;

  v_cutoff := pg_catalog.now() - (v_window || ' seconds')::INTERVAL;

  SELECT window_start, request_count INTO v_window_start, v_count
  FROM public.rate_limits
  WHERE user_id = v_uid AND action_type = p_action_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
    VALUES (v_uid, p_action_type, pg_catalog.now(), 1)
    ON CONFLICT (user_id, action_type) DO UPDATE
      SET request_count = public.rate_limits.request_count + 1;
    RETURN TRUE;
  END IF;

  IF v_window_start < v_cutoff THEN
    UPDATE public.rate_limits
    SET window_start = pg_catalog.now(), request_count = 1
    WHERE user_id = v_uid AND action_type = p_action_type;
    RETURN TRUE;
  END IF;

  IF v_count >= v_max THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE user_id = v_uid AND action_type = p_action_type;
  RETURN TRUE;
END;
$$;

CREATE TABLE IF NOT EXISTS public.pack_catalog (
  id     INTEGER PRIMARY KEY,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'))
);

INSERT INTO public.pack_catalog (id, rarity) VALUES
  (1, 'common'),
  (2, 'common'),
  (3, 'common'),
  (4, 'common'),
  (5, 'common'),
  (6, 'uncommon'),
  (7, 'uncommon'),
  (8, 'uncommon'),
  (9, 'uncommon'),
  (10, 'uncommon'),
  (11, 'rare'),
  (12, 'rare'),
  (13, 'rare'),
  (14, 'rare'),
  (15, 'rare'),
  (16, 'epic'),
  (17, 'epic'),
  (18, 'epic'),
  (19, 'epic'),
  (20, 'legendary'),
  (21, 'legendary'),
  (22, 'uncommon'),
  (23, 'rare'),
  (24, 'common'),
  (25, 'uncommon'),
  (26, 'rare'),
  (27, 'epic'),
  (30, 'common'),
  (31, 'common'),
  (32, 'uncommon'),
  (33, 'uncommon'),
  (34, 'rare'),
  (40, 'common'),
  (41, 'common'),
  (42, 'common'),
  (43, 'uncommon'),
  (44, 'uncommon'),
  (45, 'rare'),
  (46, 'epic'),
  (47, 'legendary'),
  (50, 'common'),
  (51, 'common'),
  (52, 'common'),
  (53, 'common'),
  (54, 'common'),
  (55, 'common'),
  (56, 'uncommon'),
  (57, 'uncommon'),
  (58, 'uncommon'),
  (59, 'uncommon'),
  (60, 'uncommon'),
  (61, 'uncommon'),
  (62, 'rare'),
  (63, 'rare'),
  (64, 'rare'),
  (65, 'rare'),
  (66, 'epic'),
  (67, 'epic'),
  (68, 'epic'),
  (69, 'legendary'),
  (70, 'common'),
  (71, 'common'),
  (72, 'uncommon'),
  (73, 'uncommon'),
  (74, 'rare'),
  (75, 'common'),
  (76, 'common'),
  (77, 'rare'),
  (78, 'rare'),
  (79, 'uncommon'),
  (80, 'common'),
  (81, 'uncommon'),
  (82, 'common'),
  (83, 'common'),
  (84, 'uncommon'),
  (85, 'uncommon'),
  (86, 'uncommon'),
  (87, 'rare'),
  (88, 'rare'),
  (89, 'epic'),
  (90, 'rare'),
  (91, 'common'),
  (92, 'uncommon'),
  (93, 'common'),
  (94, 'uncommon'),
  (95, 'rare'),
  (96, 'common'),
  (97, 'uncommon'),
  (98, 'rare'),
  (99, 'epic')
ON CONFLICT (id) DO UPDATE SET rarity = EXCLUDED.rarity;

CREATE TABLE IF NOT EXISTS public.pack_owned (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL REFERENCES public.pack_catalog(id),
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS public.pack_wallet (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pity           INTEGER NOT NULL DEFAULT 0,
  opens          INTEGER NOT NULL DEFAULT 0,
  sellback_coins INTEGER NOT NULL DEFAULT 0,
  sellback_day   DATE
);

CREATE TABLE IF NOT EXISTS public.pack_receipts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nonce   TEXT NOT NULL,
  coins   INTEGER NOT NULL,
  PRIMARY KEY (user_id, nonce)
);

CREATE TABLE IF NOT EXISTS public.convenience_unlocks (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  instant_open BOOLEAN NOT NULL DEFAULT FALSE,
  deck_slots   BOOLEAN NOT NULL DEFAULT FALSE,
  storage      BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.pack_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_owned ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenience_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pack_catalog_read ON public.pack_catalog;
CREATE POLICY pack_catalog_read ON public.pack_catalog FOR SELECT TO anon, authenticated USING (TRUE);

REVOKE ALL ON public.pack_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pack_catalog TO anon, authenticated;
REVOKE ALL ON public.pack_owned FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pack_wallet FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pack_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.convenience_unlocks FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.settle_pack_open(p_nonce TEXT, p_source TEXT, p_card_ids INTEGER[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_coins  INTEGER := 0;
  v_pity   INTEGER;
  v_opens  INTEGER;
  v_sold   INTEGER;
  v_day    DATE;
  v_full   INTEGER;
  v_room   INTEGER;
  v_pay    INTEGER;
  v_rare   BOOLEAN := FALSE;
  v_id     INTEGER;
  v_rarity TEXT;
  v_seen   INTEGER[] := ARRAY[]::INTEGER[];
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
  IF p_card_ids IS NULL OR cardinality(p_card_ids) < 1 OR cardinality(p_card_ids) > 10 THEN
    RAISE EXCEPTION 'bad pack' USING ERRCODE = '22023';
  END IF;

  SELECT coins INTO v_coins FROM public.pack_receipts WHERE user_id = v_uid AND nonce = p_nonce;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'coins', v_coins, 'replay', true);
  END IF;

  IF NOT public.check_rate_limit('pack_open') THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = 'PT429';
  END IF;

  INSERT INTO public.pack_wallet (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT pity, opens, sellback_coins, sellback_day
    INTO v_pity, v_opens, v_sold, v_day
  FROM public.pack_wallet WHERE user_id = v_uid FOR UPDATE;

  IF v_day IS DISTINCT FROM (pg_catalog.now() AT TIME ZONE 'utc')::date THEN
    v_sold := 0;
    v_day := (pg_catalog.now() AT TIME ZONE 'utc')::date;
  END IF;

  v_coins := 0;
  FOREACH v_id IN ARRAY p_card_ids LOOP
    SELECT rarity INTO v_rarity FROM public.pack_catalog WHERE id = v_id;
    IF v_rarity IS NULL THEN
      RAISE EXCEPTION 'unknown card' USING ERRCODE = '22023';
    END IF;
    IF v_rarity IN ('rare', 'epic', 'legendary') THEN v_rare := TRUE; END IF;
    v_full := CASE v_rarity
      WHEN 'common' THEN 15
      WHEN 'uncommon' THEN 30
      WHEN 'rare' THEN 59
      WHEN 'epic' THEN 100
      ELSE 219
    END;
    IF v_id = ANY(v_seen) OR EXISTS (
      SELECT 1 FROM public.pack_owned WHERE user_id = v_uid AND card_id = v_id
    ) THEN
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
    END IF;
    v_seen := v_seen || v_id;
  END LOOP;

  v_opens := v_opens + 1;
  IF v_opens % 6 = 0 THEN v_coins := v_coins + 72; END IF;
  IF v_rare OR v_pity + 1 >= 10 THEN v_pity := 0; ELSE v_pity := v_pity + 1; END IF;

  UPDATE public.pack_wallet
     SET pity = v_pity, opens = v_opens, sellback_coins = v_sold, sellback_day = v_day
   WHERE user_id = v_uid;
  INSERT INTO public.pack_receipts (user_id, nonce, coins) VALUES (v_uid, p_nonce, v_coins);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'coins', v_coins, 'replay', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_convenience(p_nonce TEXT, p_sku TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_gems  INTEGER;
  v_price INTEGER;
  v_row   public.convenience_unlocks%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_nonce IS NULL OR char_length(p_nonce) < 4 OR char_length(p_nonce) > 80 THEN
    RAISE EXCEPTION 'bad nonce' USING ERRCODE = '22023';
  END IF;
  v_price := CASE p_sku
    WHEN 'instant_open' THEN 80
    WHEN 'deck_slots' THEN 40
    WHEN 'storage' THEN 60
    WHEN 'streak_shield' THEN 15
    WHEN 'quest_reroll' THEN 8
    WHEN 'crawl_skip' THEN 4
    ELSE NULL
  END;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'unknown shortcut' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pack_receipts WHERE user_id = v_uid AND nonce = p_nonce) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'replay', true);
  END IF;

  IF NOT public.check_rate_limit('convenience') THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = 'PT429';
  END IF;

  SELECT gems INTO v_gems FROM public.user_gems WHERE user_id = v_uid FOR UPDATE;
  IF v_gems IS NULL OR v_gems < v_price THEN
    RAISE EXCEPTION 'not enough gems' USING ERRCODE = 'PT403';
  END IF;

  INSERT INTO public.convenience_unlocks (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_row FROM public.convenience_unlocks WHERE user_id = v_uid FOR UPDATE;
  IF (p_sku = 'instant_open' AND v_row.instant_open)
     OR (p_sku = 'deck_slots' AND v_row.deck_slots)
     OR (p_sku = 'storage' AND v_row.storage) THEN
    RAISE EXCEPTION 'already owned' USING ERRCODE = 'PT403';
  END IF;

  UPDATE public.user_gems SET gems = gems - v_price, updated_at = pg_catalog.now() WHERE user_id = v_uid;
  UPDATE public.convenience_unlocks SET
    instant_open = instant_open OR p_sku = 'instant_open',
    deck_slots = deck_slots OR p_sku = 'deck_slots',
    storage = storage OR p_sku = 'storage'
  WHERE user_id = v_uid;
  INSERT INTO public.pack_receipts (user_id, nonce, coins) VALUES (v_uid, p_nonce, 0);
  RETURN pg_catalog.jsonb_build_object('ok', true, 'gems', v_price, 'replay', false);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_pack_open(TEXT, TEXT, INTEGER[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_pack_open(TEXT, TEXT, INTEGER[]) TO authenticated;
REVOKE ALL ON FUNCTION public.buy_convenience(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_convenience(TEXT, TEXT) TO authenticated;
