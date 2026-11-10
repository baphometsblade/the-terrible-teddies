-- Social linking and friends.
-- Idempotent. One transaction, as `supabase db push` applies each file.
--
-- Discord and X are linked with Supabase Auth (`linkIdentity` /
-- `unlinkIdentity`). This file never stores a provider token. It copies the
-- display handle off `auth.identities` and, for Discord, a keyed hash of each
-- guild id. Raw guild ids are not written to any column and are not returned.
--
-- Friends sit on top of follows: accepting a request writes the friendship
-- and a follow in each direction. Unfriending leaves the follows. Blocking
-- removes the friendship, the requests, and both follows.
--
-- Live PvP seam (migration 20261110130000_pvp_matches is not on main).
-- `challenge_friend(uuid, text)` is the only client entry.
--   mode 'ghost' deals a ghost brawl now (`ladder_matches.kind = 'challenge'`).
--   mode 'live' inserts `friend_challenges` (status 'open', no deck) and
--   returns seam 'friend_challenges'. When PvP lands it should fulfill those
--   rows, or replace this live branch. Do not add a second client entry.
--
-- Tables are not writable by client roles. RLS policies describe who could
-- read a row if a grant were ever added. Presence on Realtime uses the same
-- rule through `can_see_presence`, and private-channel policies are created
-- only when `realtime.messages` already exists (hosted Supabase). This file
-- does not create or alter that table.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.social_pepper (
  id     SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pepper TEXT NOT NULL
);

INSERT INTO public.social_pepper (id, pepper)
SELECT 1, pg_catalog.md5(pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text)
WHERE NOT EXISTS (SELECT 1 FROM public.social_pepper);

CREATE TABLE IF NOT EXISTS public.linked_identities (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  linked_at        TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, provider),
  CONSTRAINT linked_identities_provider CHECK (provider IN ('discord', 'x')),
  CONSTRAINT linked_identities_provider_user UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS public.discord_guilds (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guild_hash TEXT NOT NULL,
  PRIMARY KEY (user_id, guild_hash)
);

CREATE INDEX IF NOT EXISTS discord_guilds_hash_idx
  ON public.discord_guilds (guild_hash);

CREATE TABLE IF NOT EXISTS public.friendships (
  user_low   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_high  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_low, user_high),
  CONSTRAINT friendships_ordered CHECK (user_low < user_high)
);

CREATE INDEX IF NOT EXISTS friendships_high_idx ON public.friendships (user_high);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id         UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  from_user  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT friend_requests_status CHECK (status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT friend_requests_not_self CHECK (from_user <> to_user)
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_one_pending
  ON public.friend_requests (from_user, to_user) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.player_blocks (
  blocker    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (blocker, blocked),
  CONSTRAINT player_blocks_not_self CHECK (blocker <> blocked)
);

CREATE TABLE IF NOT EXISTS public.friend_invites (
  code       TEXT PRIMARY KEY,
  inviter    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  uses       INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT friend_invites_code CHECK (code ~ '^[0-9a-f]{12}$'),
  CONSTRAINT friend_invites_uses CHECK (uses >= 0 AND uses <= 40)
);

CREATE TABLE IF NOT EXISTS public.friend_invite_redemptions (
  code       TEXT NOT NULL REFERENCES public.friend_invites(code) ON DELETE CASCADE,
  redeemer   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (code, redeemer)
);

CREATE TABLE IF NOT EXISTS public.presence_prefs (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  appear_offline BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- The live-PvP plug. Ghost rows also point at the ladder ticket they dealt.
-- Live rows have no match until PvP writes one. No FK to a table that is not
-- on main yet.
CREATE TABLE IF NOT EXISTS public.friend_challenges (
  id               UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  challenger_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  ladder_match_id  UUID REFERENCES public.ladder_matches(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT friend_challenges_mode CHECK (mode IN ('ghost', 'live')),
  CONSTRAINT friend_challenges_status CHECK (status IN ('open', 'accepted', 'done', 'cancelled')),
  CONSTRAINT friend_challenges_not_self CHECK (challenger_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS friend_challenges_open_idx
  ON public.friend_challenges (friend_id, status) WHERE status = 'open';

ALTER TABLE public.social_pepper ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linked_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invite_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;

-- No client write policies: writes stay in the functions below. A later GRANT
-- of SELECT would still only expose the rows these policies name. Guild hashes
-- and the pepper stay invisible.
DROP POLICY IF EXISTS social_pepper_none ON public.social_pepper;
CREATE POLICY social_pepper_none ON public.social_pepper
  FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS linked_identities_own ON public.linked_identities;
CREATE POLICY linked_identities_own ON public.linked_identities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS discord_guilds_none ON public.discord_guilds;
CREATE POLICY discord_guilds_none ON public.discord_guilds
  FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS friendships_member ON public.friendships;
CREATE POLICY friendships_member ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_low OR auth.uid() = user_high);

DROP POLICY IF EXISTS friend_requests_party ON public.friend_requests;
CREATE POLICY friend_requests_party ON public.friend_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

DROP POLICY IF EXISTS player_blocks_own ON public.player_blocks;
CREATE POLICY player_blocks_own ON public.player_blocks
  FOR SELECT TO authenticated USING (auth.uid() = blocker);

DROP POLICY IF EXISTS friend_invites_own ON public.friend_invites;
CREATE POLICY friend_invites_own ON public.friend_invites
  FOR SELECT TO authenticated USING (auth.uid() = inviter);

DROP POLICY IF EXISTS friend_redemptions_party ON public.friend_invite_redemptions;
CREATE POLICY friend_redemptions_party ON public.friend_invite_redemptions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = redeemer
    OR auth.uid() = (SELECT i.inviter FROM public.friend_invites i WHERE i.code = friend_invite_redemptions.code)
  );

DROP POLICY IF EXISTS presence_prefs_own ON public.presence_prefs;
CREATE POLICY presence_prefs_own ON public.presence_prefs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS friend_challenges_party ON public.friend_challenges;
CREATE POLICY friend_challenges_party ON public.friend_challenges
  FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = friend_id);

REVOKE ALL ON public.social_pepper FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.linked_identities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.discord_guilds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.friendships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.friend_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_blocks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.friend_invites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.friend_invite_redemptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.presence_prefs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.friend_challenges FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers. Not granted to client roles.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.social_rate_limit(p_action_type TEXT)
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
    WHEN 'social_publish' THEN v_max := 6;  v_window := 3600;
    WHEN 'social_ticket'  THEN v_max := 8;  v_window := 600;
    WHEN 'social_result'  THEN v_max := 10; v_window := 600;
    WHEN 'social_follow'  THEN v_max := 20; v_window := 3600;
    WHEN 'social_gang'    THEN v_max := 6;  v_window := 3600;
    WHEN 'social_cup'     THEN v_max := 8;  v_window := 600;
    WHEN 'social_taunt'   THEN v_max := 12; v_window := 600;
    WHEN 'social_report'  THEN v_max := 5;  v_window := 86400;
    WHEN 'social_refer'   THEN v_max := 4;  v_window := 86400;
    WHEN 'social_rival'   THEN v_max := 10; v_window := 3600;
    WHEN 'social_lineup'  THEN v_max := 20; v_window := 600;
    WHEN 'social_friend'  THEN v_max := 20; v_window := 3600;
    WHEN 'social_invite_make' THEN v_max := 8;  v_window := 86400;
    WHEN 'social_invite_take' THEN v_max := 10; v_window := 86400;
    WHEN 'social_search'  THEN v_max := 30; v_window := 600;
    WHEN 'social_guilds'  THEN v_max := 6;  v_window := 3600;
    WHEN 'social_challenge' THEN v_max := 12; v_window := 3600;
    WHEN 'social_block'   THEN v_max := 10; v_window := 86400;
    WHEN 'social_presence' THEN v_max := 20; v_window := 3600;
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

REVOKE ALL ON FUNCTION public.social_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;

-- Keyed hash. SHA-256 when pgcrypto is installed (hosted, or CI after the
-- extension above), MD5 otherwise. The pepper is prepended by the caller, so
-- a hash in discord_guilds is not a raw guild id and not a public digest of one.
CREATE OR REPLACE FUNCTION public.social_digest(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_schema TEXT;
  v_out    TEXT;
BEGIN
  SELECT n.nspname INTO v_schema
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'digest'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'bytea, text'
  ORDER BY CASE n.nspname WHEN 'extensions' THEN 0 WHEN 'public' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_schema IS NULL THEN
    RETURN pg_catalog.md5(COALESCE(p_value, ''));
  END IF;

  EXECUTE format(
    'SELECT pg_catalog.encode(%I.digest(pg_catalog.convert_to($1, ''UTF8''), ''sha256''), ''hex'')',
    v_schema
  ) INTO v_out USING COALESCE(p_value, '');
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.social_digest(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.social_clean_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(
      pg_catalog.left(
        pg_catalog.regexp_replace(pg_catalog.btrim(COALESCE(p_name, '')), '[[:cntrl:]<>]', '', 'g'),
        32
      ),
      ''
    ),
    'Linked'
  );
$$;

REVOKE ALL ON FUNCTION public.social_clean_name(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.social_blocked(p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_blocks b
    WHERE (b.blocker = p_a AND b.blocked = p_b)
       OR (b.blocker = p_b AND b.blocked = p_a)
  );
$$;

REVOKE ALL ON FUNCTION public.social_blocked(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.social_friends(p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.user_low = LEAST(p_a, p_b)
      AND f.user_high = GREATEST(p_a, p_b)
  );
$$;

REVOKE ALL ON FUNCTION public.social_friends(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.social_uuid(p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN NULLIF(pg_catalog.btrim(COALESCE(p_text, '')), '')::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.social_uuid(TEXT) FROM PUBLIC, anon, authenticated;

-- True for the subject themself, and for a friend who has not chosen to
-- appear offline and is not blocked in either direction. Realtime policies
-- call this as the signed-in user, so authenticated may execute it. It does
-- not return a list.
CREATE OR REPLACE FUNCTION public.can_see_presence(p_subject UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_subject IS NOT NULL
    AND NOT public.social_blocked(auth.uid(), p_subject)
    AND (
      p_subject = auth.uid()
      OR (
        public.social_friends(auth.uid(), p_subject)
        AND NOT COALESCE((
          SELECT pr.appear_offline FROM public.presence_prefs pr WHERE pr.user_id = p_subject
        ), false)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_see_presence(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_presence(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Linking. Reads auth.identities. Writes only the handle and, separately,
-- guild hashes. Unlinking (the identity row going away) deletes both.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_links()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_row      RECORD;
  v_provider TEXT;
  v_pid      TEXT;
  v_name     TEXT;
  v_seen     TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF to_regclass('auth.identities') IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  FOR v_row IN
    SELECT provider, provider_id, identity_data
    FROM auth.identities
    WHERE user_id = v_uid
  LOOP
    v_provider := CASE v_row.provider
      WHEN 'discord' THEN 'discord'
      WHEN 'twitter' THEN 'x'
      WHEN 'x' THEN 'x'
      ELSE NULL
    END;
    IF v_provider IS NULL THEN
      CONTINUE;
    END IF;
    v_pid := pg_catalog.left(COALESCE(
      NULLIF(v_row.provider_id, ''),
      v_row.identity_data->>'sub',
      v_row.identity_data->>'provider_id',
      ''
    ), 64);
    IF v_pid = '' THEN
      CONTINUE;
    END IF;
    v_name := public.social_clean_name(COALESCE(
      v_row.identity_data->>'preferred_username',
      v_row.identity_data->>'user_name',
      v_row.identity_data->>'global_name',
      v_row.identity_data->>'name',
      v_row.identity_data->>'full_name'
    ));
    BEGIN
      INSERT INTO public.linked_identities (user_id, provider, provider_user_id, display_name)
      VALUES (v_uid, v_provider, v_pid, v_name)
      ON CONFLICT (user_id, provider) DO UPDATE
        SET provider_user_id = EXCLUDED.provider_user_id,
            display_name = EXCLUDED.display_name,
            linked_at = pg_catalog.now();
    EXCEPTION WHEN unique_violation THEN
      -- That provider account is already on a different player. Leave it.
      NULL;
    END;
    v_seen := v_seen || v_provider;
  END LOOP;

  DELETE FROM public.linked_identities
  WHERE user_id = v_uid
    AND NOT (provider = ANY (v_seen));

  IF NOT ('discord' = ANY (v_seen)) THEN
    DELETE FROM public.discord_guilds WHERE user_id = v_uid;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'discord', 'discord' = ANY (v_seen),
    'x', 'x' = ANY (v_seen)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_links() TO authenticated;

CREATE OR REPLACE FUNCTION public.remember_guilds(p_guild_ids TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_pepper TEXT;
  v_id     TEXT;
  v_n      INTEGER := 0;
  v_count  INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.linked_identities
    WHERE user_id = v_uid AND provider = 'discord'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'discord');
  END IF;
  IF NOT public.social_rate_limit('social_guilds') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;

  SELECT pepper INTO v_pepper FROM public.social_pepper WHERE id = 1;
  DELETE FROM public.discord_guilds WHERE user_id = v_uid;

  IF p_guild_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_guild_ids LOOP
      v_id := pg_catalog.btrim(COALESCE(v_id, ''));
      IF v_id !~ '^[0-9]{17,20}$' THEN
        CONTINUE;
      END IF;
      IF v_n >= 100 THEN
        EXIT;
      END IF;
      INSERT INTO public.discord_guilds (user_id, guild_hash)
      VALUES (v_uid, public.social_digest(v_pepper || ':' || v_id))
      ON CONFLICT DO NOTHING;
      v_n := v_n + 1;
    END LOOP;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count FROM public.discord_guilds WHERE user_id = v_uid;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.remember_guilds(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remember_guilds(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_links()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_discord JSONB;
  v_x JSONB;
  v_off BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  SELECT pg_catalog.jsonb_build_object('linked', true, 'name', display_name)
    INTO v_discord
  FROM public.linked_identities
  WHERE user_id = v_uid AND provider = 'discord';
  SELECT pg_catalog.jsonb_build_object('linked', true, 'name', display_name)
    INTO v_x
  FROM public.linked_identities
  WHERE user_id = v_uid AND provider = 'x';
  SELECT appear_offline INTO v_off FROM public.presence_prefs WHERE user_id = v_uid;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'discord', COALESCE(v_discord, pg_catalog.jsonb_build_object('linked', false, 'name', NULL)),
    'x', COALESCE(v_x, pg_catalog.jsonb_build_object('linked', false, 'name', NULL)),
    'appear_offline', COALESCE(v_off, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_links() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_appear_offline(p_off BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT public.social_rate_limit('social_presence') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  INSERT INTO public.presence_prefs (user_id, appear_offline)
  VALUES (v_uid, COALESCE(p_off, false))
  ON CONFLICT (user_id) DO UPDATE
    SET appear_offline = EXCLUDED.appear_offline,
        updated_at = pg_catalog.now();
  RETURN pg_catalog.jsonb_build_object('ok', true, 'appear_offline', COALESCE(p_off, false));
END;
$$;

REVOKE ALL ON FUNCTION public.set_appear_offline(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_appear_offline(BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- Friends, on top of follows.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.respond_friend(p_request UUID, p_accept BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_row  public.friend_requests%ROWTYPE;
  v_low  UUID;
  v_high UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_request IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT * INTO v_row FROM public.friend_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND OR v_row.to_user <> v_uid OR v_row.status <> 'pending' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF public.social_blocked(v_uid, v_row.from_user) THEN
    UPDATE public.friend_requests SET status = 'declined' WHERE id = v_row.id;
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'no');
  END IF;

  IF NOT COALESCE(p_accept, false) THEN
    UPDATE public.friend_requests SET status = 'declined' WHERE id = v_row.id;
    RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'declined');
  END IF;

  v_low := LEAST(v_uid, v_row.from_user);
  v_high := GREATEST(v_uid, v_row.from_user);
  INSERT INTO public.friendships (user_low, user_high)
  VALUES (v_low, v_high)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.follows (follower, followee)
  VALUES (v_uid, v_row.from_user), (v_row.from_user, v_uid)
  ON CONFLICT DO NOTHING;
  UPDATE public.friend_requests SET status = 'accepted' WHERE id = v_row.id;
  UPDATE public.friend_requests SET status = 'declined'
  WHERE status = 'pending'
    AND id <> v_row.id
    AND (
      (from_user = v_uid AND to_user = v_row.from_user)
      OR (from_user = v_row.from_user AND to_user = v_uid)
    );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'accepted', 'user_id', v_row.from_user);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_friend(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_friend(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_friend(p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_incoming UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_user IS NULL OR p_user = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  IF NOT public.social_rate_limit('social_friend') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user)
     OR public.social_blocked(v_uid, p_user) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'no');
  END IF;
  IF public.social_friends(v_uid, p_user) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'friends');
  END IF;

  SELECT id INTO v_incoming FROM public.friend_requests
  WHERE from_user = p_user AND to_user = v_uid AND status = 'pending'
  LIMIT 1;
  IF v_incoming IS NOT NULL THEN
    RETURN public.respond_friend(v_incoming, true);
  END IF;

  INSERT INTO public.friend_requests (from_user, to_user)
  VALUES (v_uid, p_user)
  ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.request_friend(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_friend(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_friend(p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_user IS NULL OR p_user = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  DELETE FROM public.friendships
  WHERE user_low = LEAST(v_uid, p_user) AND user_high = GREATEST(v_uid, p_user);
  UPDATE public.friend_requests SET status = 'declined'
  WHERE status = 'pending'
    AND (
      (from_user = v_uid AND to_user = p_user)
      OR (from_user = p_user AND to_user = v_uid)
    );
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friend(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.block_player(p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_user IS NULL OR p_user = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  IF NOT public.social_rate_limit('social_block') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'no');
  END IF;
  INSERT INTO public.player_blocks (blocker, blocked)
  VALUES (v_uid, p_user)
  ON CONFLICT DO NOTHING;
  DELETE FROM public.friendships
  WHERE user_low = LEAST(v_uid, p_user) AND user_high = GREATEST(v_uid, p_user);
  UPDATE public.friend_requests SET status = 'declined'
  WHERE status = 'pending'
    AND (
      (from_user = v_uid AND to_user = p_user)
      OR (from_user = p_user AND to_user = v_uid)
    );
  DELETE FROM public.follows
  WHERE (follower = v_uid AND followee = p_user)
     OR (follower = p_user AND followee = v_uid);
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.block_player(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_player(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_player(p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_user IS NULL OR p_user = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  DELETE FROM public.player_blocks WHERE blocker = v_uid AND blocked = p_user;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.unblock_player(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_player(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_player(p_user UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_reason TEXT := pg_catalog.btrim(COALESCE(p_reason, ''));
  v_day    DATE := (pg_catalog.timezone('utc', pg_catalog.now()))::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_user IS NULL OR p_user = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  IF v_reason NOT IN ('name', 'cheat', 'spam') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF NOT public.social_rate_limit('social_report') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'no');
  END IF;
  INSERT INTO public.player_reports (reporter, target, reason, day_key)
  VALUES (v_uid, p_user, v_reason, v_day)
  ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.report_player(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_player(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.find_players(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_raw  TEXT := pg_catalog.btrim(COALESCE(p_query, ''));
  v_esc  TEXT;
  v_rows JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF pg_catalog.char_length(v_raw) < 2 OR pg_catalog.char_length(v_raw) > 24 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing', 'rows', '[]'::jsonb);
  END IF;
  IF NOT public.social_rate_limit('social_search') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow', 'rows', '[]'::jsonb);
  END IF;

  v_esc := pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(v_raw, '\', '\\'), '%', '\%'), '_', '\_');

  SELECT COALESCE(pg_catalog.jsonb_agg(row_to_json(s)::jsonb ORDER BY s.rank, s.username), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.user_id,
      public.ladder_display_name(p.user_id) AS username,
      d.display_name AS discord_name,
      x.display_name AS x_name,
      CASE
        WHEN public.social_friends(v_uid, p.user_id) THEN 'friend'
        WHEN EXISTS (
          SELECT 1 FROM public.friend_requests r
          WHERE r.status = 'pending' AND r.from_user = v_uid AND r.to_user = p.user_id
        ) THEN 'pending_out'
        WHEN EXISTS (
          SELECT 1 FROM public.friend_requests r
          WHERE r.status = 'pending' AND r.from_user = p.user_id AND r.to_user = v_uid
        ) THEN 'pending_in'
        ELSE 'none'
      END AS relation,
      CASE
        WHEN pg_catalog.lower(public.ladder_display_name(p.user_id)) = pg_catalog.lower(v_raw) THEN 0
        WHEN pg_catalog.lower(public.ladder_display_name(p.user_id)) LIKE pg_catalog.lower(v_esc) || '%' ESCAPE '\' THEN 1
        WHEN pg_catalog.lower(COALESCE(d.display_name, '')) = pg_catalog.lower(v_raw) THEN 2
        WHEN pg_catalog.lower(COALESCE(d.display_name, '')) LIKE pg_catalog.lower(v_esc) || '%' ESCAPE '\' THEN 3
        ELSE 4
      END AS rank
    FROM public.players p
    LEFT JOIN public.linked_identities d
      ON d.user_id = p.user_id AND d.provider = 'discord'
    LEFT JOIN public.linked_identities x
      ON x.user_id = p.user_id AND x.provider = 'x'
    WHERE p.user_id <> v_uid
      AND NOT public.social_blocked(v_uid, p.user_id)
      AND (
        pg_catalog.lower(public.ladder_display_name(p.user_id)) LIKE '%' || pg_catalog.lower(v_esc) || '%' ESCAPE '\'
        OR pg_catalog.lower(COALESCE(d.display_name, '')) LIKE '%' || pg_catalog.lower(v_esc) || '%' ESCAPE '\'
      )
    ORDER BY 6, 2
    LIMIT 12
  ) s;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.find_players(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_players(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.suggest_friends()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_rows JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(row_to_json(s)::jsonb ORDER BY s.shared DESC, s.username), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.user_id,
      public.ladder_display_name(p.user_id) AS username,
      d.display_name AS discord_name,
      pg_catalog.count(DISTINCT mine.guild_hash)::integer AS shared
    FROM public.discord_guilds mine
    JOIN public.discord_guilds theirs
      ON theirs.guild_hash = mine.guild_hash
     AND theirs.user_id <> mine.user_id
    JOIN public.players p ON p.user_id = theirs.user_id
    JOIN public.linked_identities d
      ON d.user_id = theirs.user_id AND d.provider = 'discord'
    WHERE mine.user_id = v_uid
      AND NOT public.social_blocked(v_uid, theirs.user_id)
      AND NOT public.social_friends(v_uid, theirs.user_id)
    GROUP BY p.user_id, d.display_name
    ORDER BY pg_catalog.count(DISTINCT mine.guild_hash) DESC, public.ladder_display_name(p.user_id)
    LIMIT 20
  ) s;

  RETURN pg_catalog.jsonb_build_object('ok', true, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.suggest_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_friends() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  discord_name TEXT,
  x_name TEXT,
  rating INTEGER,
  tier TEXT,
  since TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_season TEXT := public.ladder_season_id(pg_catalog.now());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  RETURN QUERY
  SELECT
    other.user_id,
    public.ladder_display_name(other.user_id),
    d.display_name,
    x.display_name,
    CASE WHEN l.season_id = v_season THEN l.rating ELSE public.ladder_soft(COALESCE(l.rating, 1000)) END,
    public.ladder_tier(CASE WHEN l.season_id = v_season THEN l.rating ELSE public.ladder_soft(COALESCE(l.rating, 1000)) END),
    f.created_at
  FROM public.friendships f
  JOIN LATERAL (
    SELECT CASE WHEN f.user_low = v_uid THEN f.user_high ELSE f.user_low END AS user_id
  ) other ON true
  LEFT JOIN public.linked_identities d
    ON d.user_id = other.user_id AND d.provider = 'discord'
  LEFT JOIN public.linked_identities x
    ON x.user_id = other.user_id AND x.provider = 'x'
  LEFT JOIN public.ladder_players l ON l.user_id = other.user_id
  WHERE f.user_low = v_uid OR f.user_high = v_uid
  ORDER BY f.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_friend_requests()
RETURNS TABLE (
  id UUID,
  direction TEXT,
  user_id UUID,
  username TEXT,
  discord_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  RETURN QUERY
  SELECT
    r.id,
    CASE WHEN r.to_user = v_uid THEN 'in' ELSE 'out' END,
    CASE WHEN r.to_user = v_uid THEN r.from_user ELSE r.to_user END,
    public.ladder_display_name(CASE WHEN r.to_user = v_uid THEN r.from_user ELSE r.to_user END),
    d.display_name,
    r.created_at
  FROM public.friend_requests r
  LEFT JOIN public.linked_identities d
    ON d.provider = 'discord'
   AND d.user_id = CASE WHEN r.to_user = v_uid THEN r.from_user ELSE r.to_user END
  WHERE r.status = 'pending'
    AND (r.to_user = v_uid OR r.from_user = v_uid)
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_friend_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_friend_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public.social_befriend(p_a UUID, p_b UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_a IS NULL OR p_b IS NULL OR p_a = p_b THEN
    RETURN;
  END IF;
  IF public.social_blocked(p_a, p_b) THEN
    RETURN;
  END IF;
  INSERT INTO public.friendships (user_low, user_high)
  VALUES (LEAST(p_a, p_b), GREATEST(p_a, p_b))
  ON CONFLICT DO NOTHING;
  INSERT INTO public.follows (follower, followee)
  VALUES (p_a, p_b), (p_b, p_a)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.social_befriend(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_friend_invite()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_code TEXT;
  v_try  INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF NOT public.social_rate_limit('social_invite_make') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  WHILE v_try < 5 AND v_code IS NULL LOOP
    v_try := v_try + 1;
    BEGIN
      v_code := pg_catalog.substr(pg_catalog.md5(pg_catalog.gen_random_uuid()::text), 1, 12);
      INSERT INTO public.friend_invites (code, inviter) VALUES (v_code, v_uid);
    EXCEPTION WHEN unique_violation THEN
      v_code := NULL;
    END;
  END LOOP;
  IF v_code IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'code', v_code);
END;
$$;

REVOKE ALL ON FUNCTION public.create_friend_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_friend_invite() TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_friend_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_code    TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_code, '')));
  v_inviter UUID;
  v_uses    INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF v_code !~ '^[0-9a-f]{12}$' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF NOT public.social_rate_limit('social_invite_take') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;

  SELECT inviter, uses INTO v_inviter, v_uses
  FROM public.friend_invites
  WHERE code = v_code
  FOR UPDATE;
  IF v_inviter IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF v_inviter = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  IF public.social_blocked(v_uid, v_inviter) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'no');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.friend_invite_redemptions
    WHERE code = v_code AND redeemer = v_uid
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'used');
  END IF;
  IF v_uses >= 40 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'capped');
  END IF;

  INSERT INTO public.friend_invite_redemptions (code, redeemer) VALUES (v_code, v_uid);
  UPDATE public.friend_invites SET uses = uses + 1 WHERE code = v_code;
  PERFORM public.social_befriend(v_uid, v_inviter);
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'user_id', v_inviter,
    'username', public.ladder_display_name(v_inviter)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_friend_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_friend_invite(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Ladder among friends, friend ghosts, and the challenge seam.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.friends_board()
RETURNS TABLE (
  place BIGINT,
  username TEXT,
  rating INTEGER,
  tier TEXT,
  week_wins INTEGER,
  week_losses INTEGER,
  week_delta INTEGER,
  code TEXT,
  is_me BOOLEAN,
  user_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_season TEXT := public.ladder_season_id(pg_catalog.now());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  RETURN QUERY
  SELECT
    pg_catalog.rank() OVER (ORDER BY shown.rating DESC, shown.week_delta DESC, shown.username),
    shown.username,
    shown.rating,
    public.ladder_tier(shown.rating),
    shown.week_wins,
    shown.week_losses,
    shown.week_delta,
    shown.code,
    shown.is_me,
    shown.user_id
  FROM (
    SELECT
      ids.user_id,
      public.ladder_display_name(ids.user_id) AS username,
      CASE
        WHEN l.season_id = v_season THEN COALESCE(l.rating, 1000)
        ELSE public.ladder_soft(COALESCE(l.rating, 1000))
      END AS rating,
      CASE WHEN l.season_id = v_season THEN COALESCE(l.week_wins, 0) ELSE 0 END AS week_wins,
      CASE WHEN l.season_id = v_season THEN COALESCE(l.week_losses, 0) ELSE 0 END AS week_losses,
      CASE WHEN l.season_id = v_season THEN COALESCE(l.week_delta, 0) ELSE 0 END AS week_delta,
      g.code,
      ids.user_id = v_uid AS is_me
    FROM (
      SELECT v_uid AS user_id
      UNION
      SELECT CASE WHEN f.user_low = v_uid THEN f.user_high ELSE f.user_low END
      FROM public.friendships f
      WHERE f.user_low = v_uid OR f.user_high = v_uid
    ) ids
    LEFT JOIN public.ladder_players l ON l.user_id = ids.user_id
    LEFT JOIN public.ghost_decks g ON g.user_id = ids.user_id
  ) shown
  ORDER BY shown.rating DESC, shown.week_delta DESC, shown.username;
END;
$$;

REVOKE ALL ON FUNCTION public.friends_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friends_board() TO authenticated;

CREATE OR REPLACE FUNCTION public.friend_ghosts()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  code TEXT,
  label TEXT,
  rating INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_season TEXT := public.ladder_season_id(pg_catalog.now());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  RETURN QUERY
  SELECT
    other.user_id,
    public.ladder_display_name(other.user_id),
    g.code,
    g.label,
    CASE
      WHEN l.season_id = v_season THEN COALESCE(l.rating, 1000)
      ELSE public.ladder_soft(COALESCE(l.rating, 1000))
    END,
    public.ladder_tier(CASE
      WHEN l.season_id = v_season THEN COALESCE(l.rating, 1000)
      ELSE public.ladder_soft(COALESCE(l.rating, 1000))
    END)
  FROM public.friendships f
  JOIN LATERAL (
    SELECT CASE WHEN f.user_low = v_uid THEN f.user_high ELSE f.user_low END AS user_id
  ) other ON true
  JOIN public.ghost_decks g ON g.user_id = other.user_id
  LEFT JOIN public.ladder_players l ON l.user_id = other.user_id
  WHERE f.user_low = v_uid OR f.user_high = v_uid
  ORDER BY f.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.friend_ghosts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_ghosts() TO authenticated;

CREATE OR REPLACE FUNCTION public.challenge_friend(p_friend UUID, p_mode TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_mode   TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_mode, '')));
  v_ticket JSONB;
  v_id     UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  IF p_friend IS NULL OR p_friend = v_uid THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  IF v_mode NOT IN ('ghost', 'live') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF NOT public.social_rate_limit('social_challenge') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'slow');
  END IF;
  IF NOT public.social_friends(v_uid, p_friend) OR public.social_blocked(v_uid, p_friend) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'no');
  END IF;

  IF v_mode = 'live' THEN
    INSERT INTO public.friend_challenges (challenger_id, friend_id, mode, status)
    VALUES (v_uid, p_friend, 'live', 'open')
    RETURNING id INTO v_id;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'mode', 'live',
      'challenge_id', v_id,
      'status', 'open',
      'seam', 'friend_challenges'
    );
  END IF;

  v_ticket := public.ladder_issue(p_friend, 'challenge');
  -- An already-open ticket is resumed, not recorded as a new dare. It may be
  -- against someone else; the ladder keeps one open fight at a time.
  IF v_ticket->>'match_id' IS NULL OR v_ticket->>'reason' = 'open' THEN
    RETURN v_ticket || pg_catalog.jsonb_build_object('mode', 'ghost');
  END IF;
  INSERT INTO public.friend_challenges (challenger_id, friend_id, mode, status, ladder_match_id)
  VALUES (v_uid, p_friend, 'ghost', 'open', (v_ticket->>'match_id')::uuid)
  RETURNING id INTO v_id;
  RETURN v_ticket || pg_catalog.jsonb_build_object(
    'mode', 'ghost',
    'challenge_id', v_id,
    'seam', 'ladder_matches'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.challenge_friend(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_friend(UUID, TEXT) TO authenticated;

-- Private presence channels, only where Realtime already installed its table.
-- Hosted Supabase forbids creating that table. CI has no Realtime, so this
-- is a no-op there; can_see_presence is what the policies call.
DO $do$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RETURN;
  END IF;
  IF to_regproc('realtime.topic') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS social_presence_select ON realtime.messages';
  EXECUTE $pol$
    CREATE POLICY social_presence_select
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      extension = 'presence'
      AND (SELECT realtime.topic()) LIKE 'presence:%'
      AND public.can_see_presence(public.social_uuid(pg_catalog.split_part((SELECT realtime.topic()), ':', 2)))
    )
  $pol$;
  EXECUTE 'DROP POLICY IF EXISTS social_presence_insert ON realtime.messages';
  EXECUTE $pol$
    CREATE POLICY social_presence_insert
    ON realtime.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
      extension = 'presence'
      AND (SELECT realtime.topic()) = 'presence:' || (SELECT auth.uid())::text
    )
  $pol$;
END
$do$;
