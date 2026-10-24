-- The trophy board and the caller's rank, read from an indexed column.
--
-- 20261023000000 computed every player's trophies through player_trophies()
-- on every read: leaderboard_trophies evaluated it for every players row and
-- ranked the whole table before its LIMIT 100, and get_my_rank() evaluated it
-- for every row again inside its count. The function's SET search_path clause
-- stops Postgres inlining it, so it ran once per row, and nothing could be
-- indexed. With 200,016 players that was 510-680 ms for the board and
-- 760-820 ms for the rank, against 17-22 ms for the `leaderboard` view it
-- replaced, linear in the player count and paid on every Leaderboard open.
--
-- board_trophies is the same formula as a stored generated column, so it is
-- kept in step by Postgres itself on every write to the three columns it reads
-- (nothing else writes it, and nothing can). Indexed, the board reads the top
-- of the index and stops after 100 rows (Index Scan -> WindowAgg ->
-- Incremental Sort -> Limit), and the rank is an index range count.
--
-- The formula is written out here rather than calling player_trophies(),
-- which stays as the pinned statement of it: check-migrations.sh asserts the
-- column equals player_trophies() on every row, so the two cannot drift, and
-- the client's calculateTrophies is pinned to player_trophies() as before.
-- Not the legacy `trophies` column, which predates the migration history and
-- holds whatever was written to it.
--
-- Adding a stored column rewrites the table once, under an exclusive lock:
-- quick at this size, but apply it outside peak hours on a large table.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS board_trophies INTEGER
  GENERATED ALWAYS AS (
    COALESCE(wins, 0) * 8
    + (floor(GREATEST(COALESCE(experience, 0), 0) / 100.0)::INTEGER + 1) * 10
    + COALESCE(best_win_streak, 0) * 5
  ) STORED;

CREATE INDEX IF NOT EXISTS players_board_trophies_idx
  ON public.players (board_trophies DESC);

-- The same columns, in the same order, as 20261023000000's view, so the
-- client reads it unchanged; only where `trophies` comes from moves.
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

REVOKE ALL ON public.leaderboard_trophies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard_trophies TO authenticated;

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

REVOKE EXECUTE ON FUNCTION public.get_my_rank() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;
