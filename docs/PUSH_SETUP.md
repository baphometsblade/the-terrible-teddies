# Push notifications

Pings are opt-in. The game asks for permission only after a player turns
Pings on in Settings. There is no native iOS or Android app. On iPhone and
iPad, Safari delivers Web Push only to a site that has been added to the
Home Screen, and only from Safari 16.4 onward. Settings says so.

## Generate a key pair

Run this on your machine. It prints a public key and a private key. Do not
commit the private key, and do not paste it into the repo.

```sh
npx web-push generate-vapid-keys
```

Tests generate a pair in memory with the same library and throw it away.

## Secrets

The edge function `send-push` reads three Supabase secrets:

```sh
npx supabase secrets set \
  VAPID_PUBLIC_KEY="the public key" \
  VAPID_PRIVATE_KEY="the private key" \
  VAPID_SUBJECT="mailto:you@example.com" \
  PUSH_SERVICE_ROLE_JWT="the legacy service_role JWT"
```

Hosted projects that have been migrated to the new `sb_secret_` API keys
inject that new key as `SUPABASE_SERVICE_ROLE_KEY`. It is not a JWT, so it
cannot pass `verify_jwt`. `send-push` also accepts `PUSH_SERVICE_ROLE_JWT`,
which is the legacy `service_role` JWT the database webhook sends as the
bearer. Do not put that JWT in the repo.

`VAPID_SUBJECT` is a `mailto:` address or an `https://` URL for the push
service. It is not shown to players.

The browser needs the public key only. Set the same public key on the
site:

```text
VITE_VAPID_PUBLIC_KEY=the public key
```

Until that variable is set, Settings says pings are not switched on and
does not ask for permission.

## The function

Name: `send-push`.

`verify_jwt` is `true` (`supabase/config.toml`). The gateway rejects a
missing or bad token. The function also compares the bearer, in constant
time, to the `SUPABASE_SERVICE_ROLE_KEY` secret. A player's JWT, or a
token whose payload merely claims `service_role`, does not match that
secret, so a deploy with `--no-verify-jwt` still cannot send a ping.

Deploy:

```sh
npx supabase functions deploy send-push
```

Apply `supabase/migrations/20261110170000_push_notifications.sql` first.

## How a ping is delivered

1. A trigger or `push_your_turn` calls `push_enqueue`. That checks the
   opt-in, the per-type switch, the block list, the 4-hour friend-online
   debounce, and a cap of 10 pings an hour.
2. When the check passes it inserts `push_inbox` (the in-app toast) and,
   unless quiet hours are on or this is a focused player's turn, `push_outbox`.
3. A Database Webhook on `INSERT` of `public.push_outbox` POSTs the row to
   `send-push`. In the webhook headers set:

   ```text
   Authorization: Bearer <service role key>
   Content-Type: application/json
   ```

   Supabase's webhook body (`{ "type": "INSERT", "record": { ... } }`) is
   what the function reads.
4. `send-push` loads that player's `push_subscriptions` and calls Web Push
   with the VAPID keys. A 404 or 410 deletes that subscription
   (`drop_push_endpoint`). The row is marked sent.

Quiet hours default to 02:00–08:00 in the offset the browser saved
(`tz_offset_minutes`, minutes east of UTC). During quiet hours the open
game still toasts; the phone does not buzz.

## Your turn, and Live PvP

`20261110130000_pvp_matches` is not on this branch. There is no second
client entry. After a turn is recorded, the match's security-definer
function calls:

```sql
PERFORM public.push_your_turn(match_id, next_user, actor_user);
```

`push_your_turn` is not granted to `anon` or `authenticated`. If
`player_focus` says the recipient's tab was visible in the last two
minutes, only the in-app toast is written.

The open game reports focus with `set_tab_focused` and reports coming
online with `report_presence`. A friend-online ping fires on the
transition into online, at the bar, or into a match, at most once per
friend every four hours.

## Realtime toasts

`push_inbox` is in the `supabase_realtime` publication when that
publication already exists. The signed-in player can `SELECT` their own
rows. The game subscribes and raises a toast. Strangers cannot read the
table.
