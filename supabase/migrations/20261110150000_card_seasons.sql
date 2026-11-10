-- Seasonal card drops. The row is the season: when it is on, which cards
-- it adds to packs, and how hard those cards are weighted against the
-- evergreen pool. A new season is a row. The client does not need a
-- redeploy to learn the window.
--
-- open_card_pack() is the pack-opening clock. It reads pg_catalog.now()
-- and does not take a timestamp, so a caller cannot open a season with
-- their own clock. It does not spend a pack or grant a card: the save
-- still owns the economy. The client rolls PACK_ODDS, then weights the
-- cards this function says are active. Paid packs and earned packs ask
-- the same function.
--
-- card_seasons_snapshot(timestamptz) is the same query with the clock
-- passed in, so a migration test can pin a window. Clients cannot call
-- it. The Naughty List runs from 2026-12-01 00:00 Australia/Brisbane
-- until, but not including, 2027-01-07 00:00 Australia/Brisbane.
-- ends_at is exclusive (active while now() < ends_at).

CREATE TABLE IF NOT EXISTS public.card_seasons (
  id text PRIMARY KEY,
  name text NOT NULL,
  theme text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  card_ids text[] NOT NULL,
  pack_weight_boost numeric NOT NULL,
  CONSTRAINT card_seasons_id_format CHECK (id ~ '^[a-z0-9-]{1,40}$'),
  CONSTRAINT card_seasons_window CHECK (ends_at > starts_at),
  CONSTRAINT card_seasons_boost CHECK (pack_weight_boost > 0 AND pack_weight_boost <= 20),
  CONSTRAINT card_seasons_cards CHECK (
    pg_catalog.cardinality(card_ids) BETWEEN 1 AND 40
  )
);

ALTER TABLE public.card_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS card_seasons_read ON public.card_seasons;
CREATE POLICY card_seasons_read
  ON public.card_seasons
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.card_seasons FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.card_seasons TO anon, authenticated;

INSERT INTO public.card_seasons (id, name, theme, starts_at, ends_at, card_ids, pack_weight_boost)
VALUES (
  'naughty-list',
  'The Naughty List',
  'christmas-party',
  timestamp '2026-12-01 00:00:00' AT TIME ZONE 'Australia/Brisbane',
  timestamp '2027-01-07 00:00:00' AT TIME ZONE 'Australia/Brisbane',
  ARRAY[
    'xm-desk', 'xm-reply', 'xm-ozzy', 'xm-holly', 'xm-nog',
    'xm-elf', 'xm-secret', 'xm-mistletoe', 'xm-list', 'xm-santa'
  ],
  3
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  theme = EXCLUDED.theme,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  card_ids = EXCLUDED.card_ids,
  pack_weight_boost = EXCLUDED.pack_weight_boost;

CREATE OR REPLACE FUNCTION public.card_seasons_snapshot(p_at timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'server_now', p_at,
    'seasons', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'theme', s.theme,
          'starts_at', s.starts_at,
          'ends_at', s.ends_at,
          'card_ids', pg_catalog.to_jsonb(s.card_ids),
          'pack_weight_boost', s.pack_weight_boost,
          'status', CASE
            WHEN p_at < s.starts_at THEN 'upcoming'
            WHEN p_at >= s.ends_at THEN 'ended'
            ELSE 'active'
          END
        )
        ORDER BY s.starts_at
      )
      FROM public.card_seasons s
    ), '[]'::jsonb)
  );
$$;

-- Inlined, and SECURITY DEFINER, so a client can ask what is in season
-- without a grant on card_seasons_snapshot. That function takes a clock
-- and stays revoked: a caller cannot open a season with their own time.
-- The owner is postgres, which is who applies migrations. search_path is
-- pinned empty so a caller cannot shadow pg_catalog.now().
CREATE OR REPLACE FUNCTION public.open_card_pack()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'server_now', pg_catalog.now(),
    'seasons', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'theme', s.theme,
          'starts_at', s.starts_at,
          'ends_at', s.ends_at,
          'card_ids', pg_catalog.to_jsonb(s.card_ids),
          'pack_weight_boost', s.pack_weight_boost,
          'status', CASE
            WHEN pg_catalog.now() < s.starts_at THEN 'upcoming'
            WHEN pg_catalog.now() >= s.ends_at THEN 'ended'
            ELSE 'active'
          END
        )
        ORDER BY s.starts_at
      )
      FROM public.card_seasons s
    ), '[]'::jsonb)
  );
$$;

ALTER FUNCTION public.open_card_pack() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.card_seasons_snapshot(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_card_pack() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_card_pack() TO anon, authenticated;

DO $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_boost numeric;
  v_count integer;
BEGIN
  SELECT starts_at, ends_at, pack_weight_boost, pg_catalog.cardinality(card_ids)
    INTO v_start, v_end, v_boost, v_count
  FROM public.card_seasons
  WHERE id = 'naughty-list';

  IF v_start IS DISTINCT FROM (timestamp '2026-12-01 00:00:00' AT TIME ZONE 'Australia/Brisbane') THEN
    RAISE EXCEPTION 'naughty list does not open at Brisbane midnight';
  END IF;
  IF v_end IS DISTINCT FROM (timestamp '2027-01-07 00:00:00' AT TIME ZONE 'Australia/Brisbane') THEN
    RAISE EXCEPTION 'naughty list does not close at the next Brisbane midnight';
  END IF;
  IF v_boost IS DISTINCT FROM 3 OR v_count IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'naughty list weight or card list is wrong';
  END IF;
END $$;
