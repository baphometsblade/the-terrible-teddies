-- Cloud saves, and a rank the server computes.
--
-- 1. Saves that belong to the account, not the browser.
--
--    Until now every bit of progress (cards, level, decks, coins, the Battle
--    Pass, spent gems) lived only in the browser's localStorage. A new phone
--    started at Level 1 with eleven starter cards, and because the login
--    reconcile credits `server total - lastSyncedServerGems`, and a fresh
--    profile's mark is 0, it also re-credited every gem the account had ever
--    bought, however many had been spent elsewhere.
--
--    player_saves holds one save per account. The client never touches the
--    table: RLS is on with no policies, and no client role holds any privilege
--    on it. It reads and writes only through the two SECURITY DEFINER
--    functions below, which act on auth.uid()'s row and take no user id, so
--    there is no parameter to point at somebody else's save.
--
--    put_player_save is a compare-and-swap on `rev`. A device sends the rev
--    its save was last in step with; the write lands only if the stored rev
--    still equals it (or, for a first save, if there is no row and the device
--    sends 0), and the rev goes up by one. Otherwise nothing is written and
--    the current rev comes back, so the device re-reads the server save and
--    decides what to keep (src/lib/cloudSave.js) instead of blindly
--    overwriting another device's progress.
--
--    The save is the client's own state, exactly as trustworthy as the
--    localStorage it is copied from: nothing on the server reads it to grant
--    anything. Gems are still minted only by the Stripe webhook.
--
-- 2. Trophies and rank on the server.
--
--    The leaderboard view returns players ordered by wins and the client
--    re-ranked them by trophies, so "Your Ranking" could only ever be a count
--    over the fifty rows it fetched: never beyond #51, and wrong for anyone
--    the wins ordering left out. player_trophies() is now the server's copy of
--    the client's formula (calculateTrophies / calculateLevel in
--    src/components/Leaderboard.jsx; both are pinned to the same fixture
--    values, here in scripts/check-migrations.sh and in Leaderboard.test.jsx),
--    leaderboard_trophies serves the board in trophy order with each row's
--    rank, and get_my_rank() gives the caller's own rank across every player.
--
--    leaderboard_trophies is a NEW view rather than a reordering of
--    `leaderboard`, because the client may ship before or after this file is
--    applied. The released client reads `leaderboard` and decides "50+" from
--    the view's wins ordering; reordering that view under it would bring the
--    made-up ranks back. The new client reads leaderboard_trophies and falls
--    back to `leaderboard` when it is missing. Drop `leaderboard` once no
--    deployed client reads it.

-- ============================================================================
-- 1) player_saves
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.player_saves (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  save       JSONB       NOT NULL,
  rev        BIGINT      NOT NULL CHECK (rev > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS with no policies denies every row to every client role; the REVOKE
-- removes the privileges Supabase's default grants hand every new table, so a
-- client cannot even attempt a read, a write or a TRUNCATE (which RLS does not
-- gate).
ALTER TABLE public.player_saves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_saves FROM PUBLIC, anon, authenticated;

-- The caller's save: {rev, save, updated_at}. With no row yet, rev is 0 and
-- save is null — always an object, so a client can tell "no save" from a
-- backend that does not speak this protocol.
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

-- Write the caller's save if, and only if, the server still holds the rev the
-- device last saw. Returns {ok, rev, updated_at}: on success the new rev; on a
-- conflict ok is false and rev is the CURRENT one (0 if there is no row), and
-- nothing was written.
--
-- Concurrency: two devices sending the same base rev race on the row lock.
-- The UPDATE's `rev = p_base_rev` is re-checked once the first commits, so the
-- second finds the rev moved and writes nothing; two first saves race on the
-- primary key, and ON CONFLICT DO NOTHING lets only one in.
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

REVOKE EXECUTE ON FUNCTION public.get_player_save() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.put_player_save(JSONB, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_save() TO authenticated;
GRANT EXECUTE ON FUNCTION public.put_player_save(JSONB, BIGINT) TO authenticated;

-- ============================================================================
-- 2) Trophies, the trophy-ordered board, and the caller's rank
-- ============================================================================

-- The client's formula, exactly:
--   calculateLevel(experience) = floor(max(0, experience) / 100) + 1
--   calculateTrophies(wins, level, bestStreak) = wins*8 + level*10 + bestStreak*5
-- with a missing value read as 0. Change one, change both, and the fixture
-- values in check-migrations.sh and Leaderboard.test.jsx with them.
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

REVOKE EXECUTE ON FUNCTION public.player_trophies(INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_trophies(INTEGER, INTEGER, INTEGER) TO authenticated;

-- The board in trophy order, each row with its rank among ALL players (rank()
-- runs before the LIMIT): one more than the number of players with strictly
-- more trophies, so a tie shares a place, as get_my_rank counts it. `is_me`
-- marks the caller's own row without exposing anyone's user_id. Definer
-- rights, like `leaderboard`, so it can rank across rows the caller cannot
-- read directly. LIMIT and a window function make it non-updatable, and the
-- grants below allow only SELECT regardless.
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
    public.player_trophies(p.wins, p.experience, p.best_win_streak) AS trophies,
    COALESCE(p.user_id = auth.uid(), false) AS is_me
  FROM public.players p
) t
ORDER BY t.trophies DESC, t.wins DESC, t.experience DESC, t.username
LIMIT 100;

REVOKE ALL ON public.leaderboard_trophies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.leaderboard_trophies TO authenticated;

-- The caller's place on the whole board, not just the hundred rows the view
-- returns: 1 + the number of players with strictly more trophies, and the
-- caller's own row as the board sees it (their trophies, name, wins,
-- experience and best streak). No row at all when the caller has no players
-- row yet — the client then says what it can from the board.
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
      public.player_trophies(p.wins, p.experience, p.best_win_streak) AS trophies
    FROM public.players p
    WHERE p.user_id = auth.uid()
  )
  SELECT
    1 + (
      SELECT count(*)
      FROM public.players o
      WHERE public.player_trophies(o.wins, o.experience, o.best_win_streak) > me.trophies
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
