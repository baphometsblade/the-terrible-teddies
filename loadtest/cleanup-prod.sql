-- Removes everything a production load run created, and nothing else: the
-- pvp-load-N@teddies.test accounts, every match one of them sat in (with its
-- actions, views, players and slip, by cascade), their replays, queue rows,
-- ladder rows and rate-limit rows (the account delete cascades the rest).
-- Run it through the management API's /database/query after a production run.
BEGIN;
CREATE TEMP TABLE load_users ON COMMIT DROP AS
  SELECT id FROM auth.users WHERE email ~ '^pvp-load-[0-9]+@teddies\.test$';
DELETE FROM public.pvp_matches m
  WHERE EXISTS (SELECT 1 FROM public.pvp_players p WHERE p.match_id = m.id AND p.user_id IN (SELECT id FROM load_users))
    AND NOT EXISTS (SELECT 1 FROM public.pvp_players p WHERE p.match_id = m.id AND p.user_id NOT IN (SELECT id FROM load_users));
DELETE FROM public.match_replays WHERE owner_id IN (SELECT id FROM load_users) OR opponent_id IN (SELECT id FROM load_users);
DELETE FROM public.rate_limits WHERE user_id IN (SELECT id FROM load_users);
DELETE FROM auth.users WHERE id IN (SELECT id FROM load_users);
COMMIT;
