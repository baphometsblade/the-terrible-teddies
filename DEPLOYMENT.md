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

The Supabase CLI is a developer tool, not a project dependency — install it
globally (`npm i -g supabase`) or invoke it with `npx supabase` (used below).

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

### Apply the database migrations

Migrations live in `supabase/migrations/` and are ordered by timestamp. They
create the players/purchases/user_gems tables, RLS policies, the
`SECURITY DEFINER` RPCs, rate limiting, atomic Stripe fulfillment with
refund/chargeback reversal, and the search-path hardening.

```bash
npx supabase db push
```

### Deploy the Edge Functions

```bash
npx supabase functions deploy create-checkout-session
# The webhook MUST skip JWT verification — Stripe authenticates via its
# signature header, not a Supabase JWT (also set in config.toml).
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

Deploy the migrations **before** the functions. The webhook calls
`restore_gem_purchase`, which only exists once `20260905000000` (narrowed by
`20260912000000`) has been applied; deployed first, it fails every won-dispute
event until the database catches up.

The webhook needs seven Stripe events, not three — the full list, and why each
one matters, is in step 3 of section 2.

### Set Edge Function secrets

Dashboard → Edge Functions → Secrets (or `npx supabase secrets set KEY=value`):

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
   - Events:
     - `checkout.session.completed` — credits gems (fulfillment)
     - `charge.refunded` — claws gems back on a full refund
     - `charge.dispute.created` — claws gems back on a chargeback that actually
       withdrew the funds. A `warning_*` status is an inquiry or retrieval
       request, where Stripe takes nothing, and is deliberately ignored.
     - `charge.dispute.updated` — the escalation path. An inquiry that becomes a
       real chargeback is reported as an UPDATE to the existing dispute, not as
       a second `created`, so without this the gems are never clawed back.
       Only statuses that mean the money is gone (`needs_response`,
       `under_review`, `lost`, `charge_refunded`) reverse; an update to `won`
       does nothing here.
     - `charge.dispute.funds_withdrawn` — the event that says outright that
       Stripe took the money. Reverses on the event type alone, so a dispute
       whose status updates were missed is still clawed back.
     - `charge.dispute.closed` — restores the gems when the dispute is **won**
     - `charge.dispute.funds_reinstated` — restores the gems when Stripe
       returns the money

   The last two are not optional. Without them a reversal is permanent: a
   customer whose dispute we win, or whose bank only ever raised an inquiry,
   keeps paying and loses the gems, and no replay can repair it — fulfillment
   is idempotent on `stripe_session_id` and returns `duplicate` before it
   reaches the credit.
   - Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

   Without the refund/dispute events the fulfillment still works, but a
   refunded or charged-back customer keeps their gems.

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
   `players` / `user_gems` / `purchases` and no `function_search_path_mutable`
   warnings (every `SECURITY DEFINER` function now pins its search_path).
6. If a previous deploy ever shipped the (now-removed) `battle-action` function,
   undeploy it: `npx supabase functions delete battle-action`.

---

## Security model (why it's safe to take money)

- Gems are minted **only** server-side by the Stripe webhook, after verifying
  the Stripe signature, the paid status, the paying user, and re-deriving the
  amount/currency from the server bundle table. The fulfillment RPC
  (`fulfill_gem_purchase`) records the purchase and credits gems in one
  transaction, and rejects any authenticated (non-service-role) caller.
- Each `checkout.session` credits at most once (UNIQUE `stripe_session_id`),
  atomically — a failed credit rolls the purchase row back, so a Stripe retry
  re-runs cleanly instead of leaving a paid-but-uncredited order.
- Refunds and chargebacks claw the gems back (`reverse_gem_purchase`, flooring
  the balance at 0), so a buy → spend → chargeback can't keep the goods.
- A won dispute puts the gems back (`restore_gem_purchase`), but only for a
  purchase reversed by a dispute — never one we refunded, which would let the
  customer keep both the money and the goods.
- The client-callable sync RPCs (`sync_battle_result`, `sync_player_level`)
  clamp each call (level +2, coins ≤ 1000 per battle) and are rate limited to
  5 calls a minute per action. That bounds the *rate*, not the total: a
  scripted client can still climb the public leaderboard over time — measured,
  60 level syncs reach level 100, and wins accrue without a ceiling. Gems are
  unaffected; they come only from the webhook. A cheat-proof leaderboard would
  need battles resolved on the server.
- The rate limiter accepts only the three actions the system uses
  (`checkout`, `battle_result`, `level_sync`), so it cannot be used to write
  unlimited rows.
- Spending gems can't be undone by re-reading the server balance:
  `reconcileServerGems` credits only purchases above a high-water mark. A
  server total that moves *down* is a refund or chargeback reversal, and is
  applied to the spendable balance (floored at 0) so the clawback lands.
- The leaderboard reads a view exposing only ranking columns; direct `players`
  reads are restricted to the owner's own row.
