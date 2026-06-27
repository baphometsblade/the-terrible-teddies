# Deployment Runbook

Everything needed to take Terrible Teddies from this repo to a live,
revenue-generating app. The frontend is a static Vite SPA; the backend is
Supabase (Postgres + Auth + Edge Functions); payments are real Stripe Checkout.

> Nothing works until both the Supabase backend **and** the Stripe webhook are
> deployed. The webhook is what credits gems after a payment — without it,
> customers pay and receive nothing.

---

## 1. Supabase project

The repo's `supabase/config.toml` is wired to project ref `dutkgzurneffawxesgsj`.
Use that project if it's yours; otherwise create one and update `config.toml`'s
`id`.

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### Apply the database migrations

Migrations live in `supabase/migrations/` and are ordered by timestamp. They
create the players/purchases/user_gems/matches/battles tables, RLS policies,
the `SECURITY DEFINER` RPCs, rate limiting, and the money-path hardening.

```bash
supabase db push
```

The two loose SQL files `supabase/functions/complete_daily_challenge.sql` and
`get_daily_challenge.sql` define helper RPCs — apply them too (paste into the
SQL editor or add as a migration) if you use the daily-challenge edge path.

### Deploy the Edge Functions

```bash
supabase functions deploy create-checkout-session
supabase functions deploy battle-action
# The webhook MUST skip JWT verification — Stripe authenticates via its
# signature header, not a Supabase JWT (also set in config.toml).
supabase functions deploy stripe-webhook --no-verify-jwt
```

### Set Edge Function secrets

Dashboard → Edge Functions → Secrets (or `supabase secrets set KEY=value`):

| Secret | Where it comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | created in step 3 below (`whsec_…`) |
| `SUPABASE_URL` | Settings → API |
| `SUPABASE_ANON_KEY` | Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API — **never** expose client-side |
| `ALLOWED_ORIGIN` | your production domain, e.g. `https://terribleteddies.app` |
| `DENO_ENV` | `production` |

---

## 2. Stripe

1. Use **live** keys for real revenue (test keys for staging).
2. The gem bundles and their prices are defined **server-side** in
   `supabase/functions/create-checkout-session/index.ts` and re-validated in
   `stripe-webhook/index.ts`. Prices cannot be tampered from the client. Keep
   the `GEM_BUNDLES` tables in those two files in sync.
3. Create the webhook endpoint: Stripe → Developers → Webhooks → Add endpoint
   - URL: `https://<project-ref>.functions.supabase.co/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

---

## 3. Frontend (Vercel)

Set environment variables (Project → Settings → Environment Variables):

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Settings → API anon key |
| `VITE_POSTHOG_KEY` | optional analytics |

Then deploy (`vercel.json` already configures the SPA build/rewrites):

```bash
vercel --prod
```

Point `ALLOWED_ORIGIN` (Supabase secret) at the deployed domain.

---

## 4. Post-deploy smoke test

1. Sign up / log in (Supabase Auth).
2. Play a battle to completion — coins/XP update and persist on refresh.
3. Buy the smallest gem bundle with a **real card** (or a Stripe test card on
   test keys). Confirm: redirect to Stripe → return to the app → gems credited
   within ~a minute (the webhook fired). Check `purchases` and `user_gems` rows
   in the DB.
4. Spend gems (Battle Pass premium), refresh — gems are **not** restored
   (the high-water-mark reconciliation holds).
5. Run `get_advisors` (security) on the project — expect no RLS gaps on
   `players` / `user_gems` / `purchases`.

---

## Security model (why it's safe to take money)

- Gems are minted **only** server-side by the Stripe webhook, after verifying
  the Stripe signature and re-deriving the amount from the server bundle table.
  `add_user_gems` rejects any authenticated (non-service-role) caller.
- Each `checkout.session` credits at most once (UNIQUE `stripe_session_id`),
  and the credit is bound to the paying user (`client_reference_id`).
- The client-callable sync RPCs (`sync_battle_result`, `sync_player_level`)
  clamp their inputs so a tampered client can't mint coins or jump levels.
- Spending gems can't be undone by re-reading the server balance
  (`reconcileServerGems` only credits new purchases above a high-water mark).
- The leaderboard reads a view exposing only ranking columns; direct `players`
  reads are restricted to the owner's own row.
