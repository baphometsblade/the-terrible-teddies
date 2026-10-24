# Terrible Teddies 🧸⚔️

A single-player card battler where mischievous teddy bears fight for supremacy.
Build a deck, battle an AI opponent with real teeth, climb the leaderboard,
and progress a seasonal Battle Pass.

## The game

- **Battles**: turn-based card combat against a difficulty-scaled AI. Each
  turn you draw, then play cards and attack in any order until you end it.
  Cards have energy costs and abilities — taunt, piercing, shield, stealth,
  protect, fury, swarm, royal — plus trap and special cards.
- **Collection & decks**: 60+ cards across five rarities; duplicates convert
  to coins. A deck builder with copy limits and saved decks.
- **Progression**: XP/levels, achievements, daily login rewards, daily and
  weekly challenges, and a quarterly rolling **Battle Pass** season with free
  and premium reward tracks.
- **Economy**: coins (earned) and gems (earned + purchased). Gem purchases go
  through real **Stripe Checkout**, credited server-side by a signature-verified
  webhook — prices and grants are defined server-side and cannot be tampered
  with from the client. Every pack tier posts its odds before purchase.
- **Accounts**: progress plays from the device and is kept on the player's
  account too, so a second device picks it up; when two devices have both
  moved on, the save with more progress is kept and the other stays on the
  device as a backup Settings can switch to.

## Tech stack

- **React 18 + Vite** SPA, Tailwind CSS, Framer Motion, Howler
- **Zustand** (persisted) as the single source of truth for game state
- **Supabase**: auth (with password reset), Postgres (RLS) for cloud saves,
  the leaderboard and purchases, edge functions (Deno)
- **Stripe Checkout** for real payments

## Development

```sh
npm ci
npm run dev        # dev server on :8080
npm run lint       # ESLint, zero-warning policy
npm test           # Vitest unit suite
npm run test:e2e   # Playwright end-to-end suite (hermetic — no backend needed)
npm run build      # production build to dist/
```

Copy `.env.example` to `.env` and fill in your Supabase project values.
See `CLAUDE.md` for architecture notes and `DEPLOYMENT.md` for the full
production deployment runbook (Supabase migrations, edge functions, Stripe
webhook, Vercel).

## Testing

All run in CI on every PR:

1. **Unit** (Vitest, jsdom): the economy/money paths in the game store,
   battle damage math, deck/season helpers, the opponent AI, the cloud save's
   decision rules, the Stripe webhook's event routing, and tests that hold
   the copy (tutorial, shop, odds) to the live game tables.
2. **End-to-end** (Playwright): boots the real app against a stubbed backend
   and covers every screen and dialog — battles, packs, the stores, the
   Battle Pass, cloud saves, purchases, password reset — plus an axe-core
   accessibility audit, phone-width layout checks and 44px touch targets.
   The smoke spec runs a second time against the production build.
3. **Migrations**: every SQL file is applied to a real PostgreSQL 16 and the
   resulting grants and security properties are asserted.
4. **Lint + build** gates alongside them.

## Security model (money path)

Paid currency is minted only by the Stripe webhook after signature
verification, with amounts re-derived server-side and idempotency per
checkout session. Client-callable sync RPCs clamp their inputs; leaderboard
reads go through a view that exposes only ranking columns. Details in
`DEPLOYMENT.md`.
