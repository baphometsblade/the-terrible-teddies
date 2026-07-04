# Terrible Teddies 🧸⚔️

A single-player card battler where mischievous teddy bears fight for supremacy.
Build a deck, battle an AI opponent with real teeth, climb the leaderboard,
and progress a seasonal Battle Pass.

## The game

- **Battles**: turn-based card combat (draw → main → battle → end) against a
  difficulty-scaled AI. Cards have energy costs and abilities — taunt,
  piercing, shield, stealth, protect, fury — plus trap and special cards.
- **Collection & decks**: 30+ cards across five rarities; duplicates convert
  to coins. A deck builder with copy limits and saved decks.
- **Progression**: XP/levels, achievements, daily login rewards, daily and
  weekly challenges, and a quarterly rolling **Battle Pass** season with free
  and premium reward tracks.
- **Economy**: coins (earned) and gems (earned + purchased). Gem purchases go
  through real **Stripe Checkout**, credited server-side by a signature-verified
  webhook — prices and grants are defined server-side and cannot be tampered
  with from the client.

## Tech stack

- **React 18 + Vite** SPA, Tailwind CSS, Framer Motion, Howler
- **Zustand** (persisted) as the single source of truth for game state
- **Supabase**: auth, Postgres (RLS), edge functions (Deno)
- **Stripe Checkout** for real payments

## Development

```sh
npm ci
npm run dev        # dev server on :8080
npm run lint       # ESLint, zero-warning policy
npm test           # Vitest unit suite
npm run test:e2e   # Playwright smoke suite (hermetic — no backend needed)
npm run build      # production build to dist/
```

Copy `.env.example` to `.env` and fill in your Supabase project values.
See `CLAUDE.md` for architecture notes and `DEPLOYMENT.md` for the full
production deployment runbook (Supabase migrations, edge functions, Stripe
webhook, Vercel).

## Testing

Three layers, all run in CI on every PR:

1. **Unit** (Vitest, jsdom): the economy/money paths in the game store,
   battle damage math, deck/season helpers, and the opponent AI.
2. **End-to-end** (Playwright): boots the real app against a stubbed backend
   and plays a battle turn, opens the shop, deck builder, and challenges.
3. **Lint + build** gates alongside both.

## Security model (money path)

Paid currency is minted only by the Stripe webhook after signature
verification, with amounts re-derived server-side and idempotency per
checkout session. Client-callable sync RPCs clamp their inputs; leaderboard
reads go through a view that exposes only ranking columns. Details in
`DEPLOYMENT.md`.
