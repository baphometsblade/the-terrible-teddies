-- House titles. A signed-in player wears one title from a fixed list, or
-- clears it. The id is stored on their own players row. Clients cannot
-- write the table; this function is the only writer, it takes no user id,
-- and it spends a rate-limit window the caller cannot name.
--
-- Idempotent. One transaction, as `supabase db push` applies each file.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS house_title TEXT;

CREATE OR REPLACE FUNCTION public.set_house_title(p_title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_title        TEXT := pg_catalog.btrim(COALESCE(p_title, ''::text));
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
  v_cutoff       TIMESTAMPTZ;
  v_max          INTEGER := 10;
  v_window       INTEGER := 60;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  -- Length first, then the allowlist. The list is the titles the client
  -- offers (src/lib/titles.js). Anything else is not a title.
  IF pg_catalog.char_length(v_title) > 24 THEN
    RAISE EXCEPTION 'unknown title' USING ERRCODE = '22023';
  END IF;
  IF v_title <> '' AND v_title NOT IN (
    'lucky', 'counsel', 'connected', 'too_old', 'seven',
    'regular', 'closing', 'upstairs', 'staff', 'last_call'
  ) THEN
    RAISE EXCEPTION 'unknown title' USING ERRCODE = '22023';
  END IF;

  -- Ten wears a minute. The action name is fixed here, never taken from the
  -- caller, so this cannot mint a rate_limits row for an arbitrary key.
  v_cutoff := pg_catalog.now() - (v_window || ' seconds')::INTERVAL;

  SELECT window_start, request_count INTO v_window_start, v_count
  FROM public.rate_limits
  WHERE user_id = v_uid AND action_type = 'house_title'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
    VALUES (v_uid, 'house_title', pg_catalog.now(), 1)
    ON CONFLICT (user_id, action_type) DO UPDATE
      SET request_count = public.rate_limits.request_count + 1;
  ELSIF v_window_start < v_cutoff THEN
    UPDATE public.rate_limits
    SET window_start = pg_catalog.now(), request_count = 1
    WHERE user_id = v_uid AND action_type = 'house_title';
  ELSIF v_count >= v_max THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = 'PT429';
  ELSE
    UPDATE public.rate_limits
    SET request_count = request_count + 1
    WHERE user_id = v_uid AND action_type = 'house_title';
  END IF;

  UPDATE public.players
  SET house_title = NULLIF(v_title, ''::text)
  WHERE user_id = v_uid;

  RETURN NULLIF(v_title, ''::text);
END;
$$;

REVOKE ALL ON FUNCTION public.set_house_title(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_house_title(TEXT) TO authenticated;
