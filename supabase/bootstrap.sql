-- Terrible Teddies: full schema for an empty Supabase project.
-- Idempotent. Run once in the SQL editor (or psql) as a role that owns the
-- public schema and can create a trigger on auth.users. Safe to run again.
--
-- This is the end state of supabase/migrations, not a replay of them. It does
-- not include one-time data backfills. Do not also db-push those migrations
-- onto a database this file has already built: the two describe the same
-- objects.
--
-- Clients may SELECT their own rows on players, purchases and user_gems.
-- They cannot write those tables directly. Stats, gems and saves move only
-- through the functions below, which check auth.uid() or the service role.
-- The leaderboard views are readable by anon and authenticated and run as
-- the owner, so a player can see the board without reading other players' rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.players (
  user_id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            TEXT,
  coins               INTEGER     NOT NULL DEFAULT 0,
  wins                INTEGER     NOT NULL DEFAULT 0,
  losses              INTEGER     NOT NULL DEFAULT 0,
  total_wins          INTEGER     NOT NULL DEFAULT 0,
  total_losses        INTEGER     NOT NULL DEFAULT 0,
  total_battles       INTEGER     NOT NULL DEFAULT 0,
  best_win_streak     INTEGER     NOT NULL DEFAULT 0,
  current_win_streak  INTEGER     NOT NULL DEFAULT 0,
  total_damage_dealt  INTEGER     NOT NULL DEFAULT 0,
  total_healing_done  INTEGER     NOT NULL DEFAULT 0,
  level               INTEGER     NOT NULL DEFAULT 1,
  xp                  INTEGER     NOT NULL DEFAULT 0,
  experience          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS username           TEXT,
  ADD COLUMN IF NOT EXISTS coins              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wins               INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_wins         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_losses       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_battles      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_win_streak    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_win_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_damage_dealt INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_healing_done INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level              INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp                 INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS experience         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS board_trophies INTEGER
  GENERATED ALWAYS AS (
    COALESCE(wins, 0) * 8
    + (floor(GREATEST(COALESCE(experience, 0), 0) / 100.0)::INTEGER + 1) * 10
    + COALESCE(best_win_streak, 0) * 5
  ) STORED;

CREATE INDEX IF NOT EXISTS players_board_trophies_idx
  ON public.players (board_trophies DESC);

CREATE TABLE IF NOT EXISTS public.purchases (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  bundle_id          TEXT        NOT NULL,
  gems_granted       INTEGER     NOT NULL CHECK (gems_granted > 0),
  stripe_session_id  TEXT        UNIQUE NOT NULL,
  amount_paid        INTEGER     NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'completed',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS payment_intent TEXT;

CREATE INDEX IF NOT EXISTS purchases_payment_intent_idx
  ON public.purchases (payment_intent);

CREATE TABLE IF NOT EXISTS public.user_gems (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gems             INTEGER     NOT NULL DEFAULT 0 CHECK (gems >= 0),
  total_purchased  INTEGER     NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_saves (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  save       JSONB       NOT NULL,
  rev        BIGINT      NOT NULL CHECK (rev > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkout_holds (
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle_id         TEXT        NOT NULL,
  stripe_session_id TEXT        NOT NULL,
  checkout_url      TEXT        NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bundle_id)
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id        UUID        NOT NULL,
  action_type    TEXT        NOT NULL,
  window_start   TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count  INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action_type)
);

CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- Functions (latest body of each, from supabase/migrations)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) IN ('service_role', '');
$$;

CREATE OR REPLACE FUNCTION public.one_per_account_bundle(p_bundle_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT p_bundle_id = ANY (ARRAY['starter_bundle']);
$$;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_max_requests INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_max     INTEGER;
  v_window  INTEGER;
  v_window_start TIMESTAMPTZ;
  v_count   INTEGER;
  v_cutoff  TIMESTAMPTZ;
BEGIN
  IF NOT public.is_service_role() AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: cannot consume another user''s rate limit';
  END IF;

  -- Server-owned limits, keyed on the action. The action must be one this
  -- system actually uses: anything else is rejected rather than defaulted, so
  -- the caller cannot mint new partitions of the rate_limits table.
  CASE p_action_type
    WHEN 'checkout'      THEN v_max := 5; v_window := 60;
    WHEN 'battle_result' THEN v_max := 5; v_window := 60;
    WHEN 'level_sync'    THEN v_max := 5; v_window := 60;
    ELSE RAISE EXCEPTION 'Unknown rate limit action: %', left(coalesce(p_action_type, '<null>'), 40);
  END CASE;

  v_cutoff := NOW() - (v_window || ' seconds')::INTERVAL;

  SELECT window_start, request_count INTO v_window_start, v_count
  FROM rate_limits
  WHERE user_id = p_user_id AND action_type = p_action_type
  FOR UPDATE;

  IF NOT FOUND THEN
    -- ON CONFLICT because SELECT ... FOR UPDATE cannot lock a row that does not
    -- exist yet: two concurrent first-calls both reach here, and without this
    -- the loser raised a unique violation instead of being counted.
    INSERT INTO rate_limits (user_id, action_type, window_start, request_count)
    VALUES (p_user_id, p_action_type, NOW(), 1)
    ON CONFLICT (user_id, action_type) DO UPDATE
      SET request_count = rate_limits.request_count + 1;
    RETURN TRUE;
  END IF;

  IF v_window_start < v_cutoff THEN
    UPDATE rate_limits
    SET window_start = NOW(), request_count = 1
    WHERE user_id = p_user_id AND action_type = p_action_type;
    RETURN TRUE;
  END IF;

  IF v_count >= v_max THEN
    RETURN FALSE;
  END IF;

  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action_type = p_action_type;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_rate_limits(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'cleanup_rate_limits may only be called server-side';
  END IF;

  DELETE FROM rate_limits
  WHERE window_start < NOW() - (p_older_than_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION add_user_gems(p_user_id UUID, p_gems INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'add_user_gems may only be called server-side';
  END IF;

  IF p_gems <= 0 THEN
    RAISE EXCEPTION 'Gem amount must be positive';
  END IF;

  INSERT INTO user_gems (user_id, gems, total_purchased)
  VALUES (p_user_id, p_gems, p_gems)
  ON CONFLICT (user_id) DO UPDATE SET
    gems            = user_gems.gems + p_gems,
    total_purchased = user_gems.total_purchased + p_gems,
    updated_at      = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION upsert_player_profile(
  p_user_id  UUID,
  p_username TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_username, ''));
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s profile';
  END IF;

  -- Same rules set_player_username enforces; anything failing them falls back
  -- to the generated name instead of being stored verbatim.
  IF char_length(v_name) < 2
     OR char_length(v_name) > 20
     OR v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    v_name := 'Player_' || LEFT(p_user_id::text, 8);
  END IF;

  INSERT INTO public.players (user_id, username)
  VALUES (p_user_id, v_name)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION set_player_username(p_username TEXT)
RETURNS TEXT                     -- the stored (trimmed) name, so the client can echo it
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_username, ''));
BEGIN
  -- A user may only rename themselves.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be signed in to set a username';
  END IF;

  -- 2–20 chars, letters/digits/space and a small punctuation set. Rejects
  -- control chars, angle brackets and the like so a hostile name cannot carry
  -- markup into another player's leaderboard row.
  IF length(v_name) < 2 OR length(v_name) > 20 THEN
    RAISE EXCEPTION 'Username must be 2 to 20 characters';
  END IF;
  IF v_name !~ '^[A-Za-z0-9 _.!?-]+$' THEN
    RAISE EXCEPTION 'Username contains disallowed characters';
  END IF;

  -- Ensure the row exists (a returning player always has one; be defensive).
  INSERT INTO public.players (user_id, username)
  VALUES (auth.uid(), v_name)
  ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username;

  RETURN v_name;
END;
$$;

CREATE OR REPLACE FUNCTION sync_battle_result(
  p_user_id UUID,
  p_won BOOLEAN,
  p_damage_dealt INTEGER DEFAULT 0,
  p_healing_done INTEGER DEFAULT 0,
  p_coins_earned INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_current_streak INTEGER;
  v_best_streak INTEGER;
  v_coins INTEGER;
  v_damage INTEGER;
  v_healing INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s stats';
  END IF;

  -- Throttle: once the per-window budget is spent, drop the write. Battles are
  -- client-resolved, so this is the only brake on looping forged wins.
  IF NOT public.check_rate_limit(p_user_id, 'battle_result') THEN
    RETURN;
  END IF;

  -- Clamp client-supplied magnitudes to sane per-battle maxima.
  v_coins   := LEAST(GREATEST(COALESCE(p_coins_earned, 0), 0), 1000);
  v_damage  := LEAST(GREATEST(COALESCE(p_damage_dealt, 0), 0), 10000);
  v_healing := LEAST(GREATEST(COALESCE(p_healing_done, 0), 0), 10000);

  SELECT current_win_streak, best_win_streak
  INTO v_current_streak, v_best_streak
  FROM public.players WHERE user_id = p_user_id;

  IF p_won THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
    v_best_streak := GREATEST(COALESCE(v_best_streak, 0), v_current_streak);
  ELSE
    v_current_streak := 0;
  END IF;

  UPDATE public.players SET
    total_wins = total_wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
    total_losses = total_losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    total_battles = total_battles + 1,
    wins = COALESCE(wins, 0) + (CASE WHEN p_won THEN 1 ELSE 0 END),
    losses = COALESCE(losses, 0) + (CASE WHEN p_won THEN 0 ELSE 1 END),
    current_win_streak = v_current_streak,
    best_win_streak = v_best_streak,
    total_damage_dealt = total_damage_dealt + v_damage,
    total_healing_done = total_healing_done + v_healing,
    coins = coins + v_coins
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION sync_player_level(
  p_user_id UUID,
  p_level INTEGER,
  p_xp INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s level';
  END IF;

  -- Throttle like sync_battle_result below. The +200/call bound alone only
  -- raises the cost of the header's fraud from 1 RPC to a 50-iteration console
  -- loop (a couple of seconds): experience climbs +200 per call to 10000 and
  -- the leaderboard still shows level 101 with zero battles. check_rate_limit's
  -- server-owned default (5/60s) turns that loop into a multi-minute grind
  -- while honest play — one sync per battle — never notices.
  IF NOT public.check_rate_limit(p_user_id, 'level_sync') THEN
    RETURN;
  END IF;

  UPDATE public.players SET
    level = LEAST(GREATEST(level, LEAST(p_level, level + 2)), 100),
    xp = LEAST(GREATEST(COALESCE(p_xp, 0), 0), 10000),
    -- Bounded increase: never more than +200 over the current stored value,
    -- never below it, capped at 10000. This is the fraud fix — setting
    -- experience straight to the client value defeated the level throttle.
    experience = LEAST(
      GREATEST(COALESCE(experience, 0), LEAST(COALESCE(p_xp, 0), COALESCE(experience, 0) + 200)),
      10000
    )
  WHERE user_id = p_user_id
    AND p_level >= level;
END;
$$;

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

CREATE OR REPLACE FUNCTION reverse_gem_purchase(
  p_payment_intent TEXT,
  p_reason         TEXT
)
RETURNS TEXT
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
    RAISE EXCEPTION 'reverse_gem_purchase may only be called server-side';
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

  IF v_status <> 'completed' THEN
    RETURN 'already_reversed';
  END IF;

  UPDATE user_gems
  SET gems       = GREATEST(gems - v_gems, 0),
      updated_at = NOW()
  WHERE user_id = v_user_id;

  UPDATE purchases
  SET status = p_reason
  WHERE id = v_id;

  RETURN 'reversed';
END;
$$;

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

CREATE OR REPLACE FUNCTION public.get_player_save()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.player_saves%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  SELECT * INTO v_row FROM public.player_saves WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('rev', 0, 'save', NULL, 'updated_at', NULL);
  END IF;
  RETURN jsonb_build_object('rev', v_row.rev, 'save', v_row.save, 'updated_at', v_row.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.put_player_save(p_save JSONB, p_base_rev BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rev BIGINT;
  v_at  TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_save IS NULL OR jsonb_typeof(p_save) <> 'object' THEN
    RAISE EXCEPTION 'a save must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF p_base_rev IS NULL OR p_base_rev < 0 THEN
    RAISE EXCEPTION 'base rev must be 0 or more' USING ERRCODE = '22023';
  END IF;
  -- The size cap, in bytes of the save's JSON text. A real save is a few
  -- kilobytes (64 cards, some decks, the claim ledgers); 64 KiB leaves room
  -- for many saved decks while keeping one row from growing without bound.
  -- PT413 reaches the client as HTTP 413 (PostgREST maps PTxxx to status
  -- xxx), so a save over the cap is told apart from a server that is down.
  -- The client checks the same limit (CLOUD_SAVE_MAX_BYTES) before sending.
  IF octet_length(p_save::text) > 65536 THEN
    RAISE EXCEPTION 'save is larger than 64 KiB' USING ERRCODE = 'PT413';
  END IF;

  IF p_base_rev = 0 THEN
    INSERT INTO public.player_saves (user_id, save, rev)
    VALUES (v_uid, p_save, 1)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING rev, updated_at INTO v_rev, v_at;
  ELSE
    UPDATE public.player_saves
       SET save = p_save, rev = rev + 1, updated_at = now()
     WHERE user_id = v_uid AND rev = p_base_rev
    RETURNING rev, updated_at INTO v_rev, v_at;
  END IF;

  IF v_rev IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'rev', v_rev, 'updated_at', v_at);
  END IF;

  SELECT rev, updated_at INTO v_rev, v_at FROM public.player_saves WHERE user_id = v_uid;
  RETURN jsonb_build_object('ok', false, 'rev', COALESCE(v_rev, 0), 'updated_at', v_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.player_trophies(
  p_wins INTEGER,
  p_experience INTEGER,
  p_best_win_streak INTEGER
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(p_wins, 0) * 8
       + (floor(GREATEST(COALESCE(p_experience, 0), 0) / 100.0)::INTEGER + 1) * 10
       + COALESCE(p_best_win_streak, 0) * 5
$$;

CREATE OR REPLACE FUNCTION public.get_my_rank()
RETURNS TABLE (
  rank BIGINT,
  trophies INTEGER,
  username TEXT,
  wins INTEGER,
  experience INTEGER,
  best_win_streak INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH me AS (
    SELECT
      p.username,
      COALESCE(p.wins, 0)            AS wins,
      COALESCE(p.experience, 0)      AS experience,
      COALESCE(p.best_win_streak, 0) AS best_win_streak,
      p.board_trophies               AS trophies
    FROM public.players p
    WHERE p.user_id = auth.uid()
  )
  SELECT
    1 + (
      SELECT count(*)
      FROM public.players o
      WHERE o.board_trophies > me.trophies
    ),
    me.trophies,
    me.username,
    me.wins,
    me.experience,
    me.best_win_streak
  FROM me
$$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.leaderboard
WITH (security_invoker = false) AS
SELECT
  username,
  COALESCE(wins, 0)            AS wins,
  COALESCE(losses, 0)          AS losses,
  COALESCE(experience, 0)      AS experience,
  COALESCE(best_win_streak, 0) AS best_win_streak
FROM public.players
ORDER BY wins DESC NULLS LAST, experience DESC NULLS LAST
LIMIT 100;

CREATE OR REPLACE VIEW public.leaderboard_trophies
WITH (security_invoker = false) AS
SELECT
  t.username,
  t.wins,
  t.losses,
  t.experience,
  t.best_win_streak,
  t.trophies,
  rank() OVER (ORDER BY t.trophies DESC) AS rank,
  t.is_me
FROM (
  SELECT
    p.username,
    COALESCE(p.wins, 0)            AS wins,
    COALESCE(p.losses, 0)          AS losses,
    COALESCE(p.experience, 0)      AS experience,
    COALESCE(p.best_win_streak, 0) AS best_win_streak,
    p.board_trophies               AS trophies,
    COALESCE(p.user_id = auth.uid(), false) AS is_me
  FROM public.players p
) t
ORDER BY t.trophies DESC, t.wins DESC, t.experience DESC, t.username
LIMIT 100;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players_select_own" ON public.players;
DROP POLICY IF EXISTS "players_select_authenticated" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.players;
DROP POLICY IF EXISTS "Allow read access for own player data" ON public.players;
DROP POLICY IF EXISTS "players_update_own" ON public.players;
DROP POLICY IF EXISTS "Users can update own profile" ON public.players;
DROP POLICY IF EXISTS "Users can update own player data" ON public.players;
CREATE POLICY "players_select_own"
  ON public.players FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "purchases_select_own" ON public.purchases;
CREATE POLICY "purchases_select_own"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_gems_select_own" ON public.user_gems;
CREATE POLICY "user_gems_select_own"
  ON public.user_gems FOR SELECT
  USING (auth.uid() = user_id);

-- No policies on player_saves, checkout_holds or rate_limits: with RLS on,
-- the absence of a policy denies every client row. The functions below are
-- SECURITY DEFINER and are the only writers.

-- ---------------------------------------------------------------------------
-- Privileges. Supabase grants new objects to anon by default; take that back,
-- then grant only what each caller needs.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.players FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.players TO anon, authenticated;

REVOKE ALL ON public.purchases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_gems FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.purchases TO anon, authenticated;
GRANT SELECT ON public.user_gems TO anon, authenticated;

REVOKE ALL ON public.player_saves FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.checkout_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.checkout_holds TO service_role;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.leaderboard TO anon, authenticated;
REVOKE ALL ON public.leaderboard_trophies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard_trophies TO anon, authenticated;

REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO service_role;

REVOKE ALL ON FUNCTION public.one_per_account_bundle(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.one_per_account_bundle(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.check_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cleanup_rate_limits(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.add_user_gems(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_gems(UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_player_profile(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_player_profile(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.set_player_username(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_username(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_battle_result(UUID, BOOLEAN, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_battle_result(UUID, BOOLEAN, INTEGER, INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_player_level(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_player_level(UUID, INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_gem_purchase(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.reverse_gem_purchase(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_gem_purchase(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.restore_gem_purchase(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_gem_purchase(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.record_refunded_duplicate(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_refunded_duplicate(UUID, TEXT, INTEGER, TEXT, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_checkout_hold(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_hold(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_checkout_hold(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_checkout_hold(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_player_save() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_save() TO authenticated;

REVOKE ALL ON FUNCTION public.put_player_save(JSONB, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.put_player_save(JSONB, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.player_trophies(INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_trophies(INTEGER, INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_rank() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;

-- ---------------------------------------------------------------------------
-- A profile row (and an empty gem balance) the moment someone signs up.
-- upsert_player_profile refuses to run without the caller's JWT, so signup
-- cannot use it. This trigger runs as its owner.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.players (user_id, username)
  VALUES (NEW.id, 'Player_' || left(NEW.id::text, 8))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_gems (user_id, gems, total_purchased)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
