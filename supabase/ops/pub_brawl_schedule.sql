-- Pub Brawl's clock and replay retention, scheduled inside Postgres.
-- Not a migration: it needs pg_cron, pg_net and Vault, which the scratch
-- Postgres in scripts/check-migrations.sh does not have. Apply it once per
-- project, after the functions are deployed, through the SQL editor or the
-- Management API. Re-running it is safe.
--
-- Vault holds the values; nothing secret is written here. Before running:
--   select vault.create_secret('<random 32+ bytes>', 'tt_pvp_cron_secret');
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'tt_functions_url');
-- The same random value is the PVP_CRON_SECRET function secret.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.pvp_cron_call(p_function text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_base text;
  v_secret text;
BEGIN
  IF p_function NOT IN ('pvp-timeout', 'replay-prune') THEN
    RAISE EXCEPTION 'pvp_cron_call: % is not a scheduled function', p_function;
  END IF;
  SELECT decrypted_secret INTO v_base FROM vault.decrypted_secrets WHERE name = 'tt_functions_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'tt_pvp_cron_secret';
  IF v_base IS NULL OR v_base = '' OR v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'pvp cron vault secrets missing';
    RETURN NULL;
  END IF;
  RETURN net.http_post(
    url := rtrim(v_base, '/') || '/' || p_function,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pvp-cron-secret', v_secret),
    timeout_milliseconds := 10000
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.pvp_cron_call(text) FROM PUBLIC, anon, authenticated;

-- Turns also end lazily on the next sync or move. This sweep catches seats
-- where both players have gone quiet.
SELECT cron.schedule('pvp-timeout', '* * * * *', $$SELECT private.pvp_cron_call('pvp-timeout')$$);
-- 03:17 UTC is 13:17 in Brisbane: a quiet hour for the bar.
SELECT cron.schedule('replay-prune', '17 3 * * *', $$SELECT private.pvp_cron_call('replay-prune')$$);
