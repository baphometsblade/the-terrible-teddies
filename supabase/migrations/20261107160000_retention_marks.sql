-- Permanent retention marks: plaques, level-track claims, story chapters,
-- and starred sets. The account records that a mark was taken. The coins
-- still live in the save. Weekly and daily gifts are not marks: their ids
-- would be a new string every period.
--
-- Idempotent. One transaction.

CREATE TABLE IF NOT EXISTS public.retention_marks (
  user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  mark       TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, mark)
);

ALTER TABLE public.retention_marks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.retention_marks FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_retention_mark(p_mark TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_mark         TEXT := pg_catalog.btrim(COALESCE(p_mark, ''::text));
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
  v_cutoff       TIMESTAMPTZ;
  v_max          INTEGER := 20;
  v_window       INTEGER := 60;
  v_inserted     TEXT := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;

  IF pg_catalog.char_length(v_mark) > 40
     OR v_mark NOT IN (
       'plaque_10', 'plaque_25', 'plaque_50',
       'level_2', 'level_3', 'level_5', 'level_8', 'level_10',
       'level_15', 'level_20', 'level_25', 'level_35', 'level_50',
       'story_first_round', 'story_lock_in', 'story_chucks_crew',
       'star_common', 'star_uncommon', 'star_rare', 'star_epic', 'star_legendary'
     ) THEN
    RAISE EXCEPTION 'unknown mark' USING ERRCODE = '22023';
  END IF;

  -- Twenty marks a minute. The action name is fixed here.
  v_cutoff := pg_catalog.now() - (v_window || ' seconds')::INTERVAL;

  SELECT window_start, request_count INTO v_window_start, v_count
  FROM public.rate_limits
  WHERE user_id = v_uid AND action_type = 'retention_mark'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
    VALUES (v_uid, 'retention_mark', pg_catalog.now(), 1)
    ON CONFLICT (user_id, action_type) DO UPDATE
      SET request_count = public.rate_limits.request_count + 1;
  ELSIF v_window_start < v_cutoff THEN
    UPDATE public.rate_limits
    SET window_start = pg_catalog.now(), request_count = 1
    WHERE user_id = v_uid AND action_type = 'retention_mark';
  ELSIF v_count >= v_max THEN
    RAISE EXCEPTION 'slow down' USING ERRCODE = 'PT429';
  ELSE
    UPDATE public.rate_limits
    SET request_count = request_count + 1
    WHERE user_id = v_uid AND action_type = 'retention_mark';
  END IF;

  INSERT INTO public.retention_marks (user_id, mark, claimed_at)
  VALUES (v_uid, v_mark, pg_catalog.now())
  ON CONFLICT (user_id, mark) DO NOTHING
  RETURNING mark INTO v_inserted;

  RETURN v_inserted IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_retention_mark(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_retention_mark(TEXT) TO authenticated;
