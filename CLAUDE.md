# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
npm run lint         # ESLint check (js,jsx files)
npm test             # Run the Vitest suite once
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright end-to-end suite
npm run art:generate # Regenerate card art (see public/cards/README.md)
npm run art:monitor  # Live dashboard for an art-generation run
npm run art:thumbs   # Rebuild the 192x256 card thumbnails
npm run art:tokens   # Check every art prompt against CLIP's 77-token limit
```

`art:tokens` needs `pip install tokenizers` and is not in CI (it downloads a
model). Run it after editing any `scene` in `src/data/cardArt.js`: CLIP
silently discards everything past 77 tokens, and what it drops is the tail of
the prompt — exactly where the staging and the visual punchline live. The
script pins the text encoding as UTF-8 on purpose; decoding the em-dash each
prompt uses as cp1252 inflates counts by ~4 tokens and invents overruns that
are not there.

Tests use **Vitest** (jsdom) and live next to the code as `*.test.js`. The
suite focuses on the pure, high-stakes logic — the `gameStore` economy/money
paths, `battleUtils` damage math, the opponent AI, the deck/season helpers,
and a `gemBundles` guard that fails if the four gem price tables (Shop UI,
checkout session, webhook, analytics) ever drift. Run a single file with
`npx vitest run src/stores/gameStore.test.js`.

A second family of tests pins **claims against reality**, because prose and
data drift apart silently while code keeps compiling. Each derives what it
expects from the live tables rather than restating a number, so retuning the
game fails the build until the copy is retuned with it:
`Tutorial.test.js` (the tutorial must name every ability a card can actually
carry), `shopCopy.test.js` (no advertising exclusivity the pack pool does not
enforce; BEST VALUE must sit on the cheapest tier), `cosmetics.test.js` (every
`exclusive` the Battle Pass sells must be renderable, or players pay for a
no-op), `migrations.test.js` + `scripts/check-migrations.sh` (the SQL must
apply to a real Postgres and the security properties must hold), and
`stubs/supabase-stubs.test.js` (see Code Splitting).

End-to-end tests (`npm run test:e2e`, Playwright, `e2e/`) boot the real app
hermetically (fake session seeded in localStorage, all network stubbed; the
shared boot lives in `e2e/helpers/session.js`). `e2e/smoke.spec.js` covers
boot, a full battle turn including an attack/exhaustion cycle, the game-over →
Play Again flow, shop/deck-builder/challenges, and nested-dialog Escape
handling. `e2e/a11y.spec.js` runs axe-core (WCAG 2.1 A/AA) against every
screen and dialog and fails on any violation — it audits the *settled* page,
because axe composites colours and an element caught mid-fade reports a
blended colour rather than its resting one. `e2e/responsive.spec.js` asserts
the document never scrolls sideways on any screen at 390px. CI
(`.github/workflows/node.js.yml`) runs lint, build, unit and e2e on every PR to
`main`, plus two jobs worth knowing about: `e2e-prod` reruns the smoke spec
against a real `vite preview` of `dist/` (a prod-only break — chunking,
minification, a stale CSP hash — is invisible to the dev-server run), and
`migrations` replays every SQL file against a postgres:16 service container and
asserts the resulting grants, because a migration Postgres refuses to apply is
invisible to every other gate.

## Architecture Overview

### Core Stack
- **React 18** + Vite (SPA, no SSR)
- **Zustand** with `persist` middleware for all game state (localStorage)
- **Supabase** for auth + edge functions + database
- **Framer Motion** for animations, **Howler.js** for sounds, **canvas-confetti** for effects

Battle sound effects live in `src/utils/sounds.js`, served from
`public/sounds/` — **never hotlinked**. They used to point at a third-party
CDN, and three of those URLs silently started returning 403, killing four of
the eight sounds with no error anyone could see: a `Howl` that fails to load
does not throw, it just never makes a noise. `sounds.test.js` now fails if a
spec points at an external URL or at a file that does not exist on disk.

Only four clips survived that CDN, so four events currently share a sibling's
clip (marked interim in the source). Replacing them is a content task: drop
files in `public/sounds/` and repoint `SOUND_SPECS`.

The `Howl` objects are built on first play, never at module scope — Howler
preloads on construction, so an eager table fetched every clip as soon as the
battle chunk loaded, including for players with sound switched off. Each Howl
also carries an `onloaderror` that evicts it from the cache, because Howler
queues every `play()` against a still-loading instance and a clip that never
loads would grow that queue for the whole session. `playSound(name, enabled)`
is the only entry point.

### State Management

All game state lives in `src/stores/gameStore.js`:
- Exports: `useGameStore`, `ALL_CARDS`, `ACHIEVEMENTS`, `DAILY_REWARDS`, `SHOP_ITEMS`
- Key fields: `coins`, `gems`, `xp`, `level`, `ownedCards`, `currentDeck`, `totalWins`, `currentWinStreak`
- Daily/weekly challenge stats auto-reset via date comparison in `recordBattleResult()`
- `pendingAchievements` queue (not persisted) for toast notifications

The store is the single source of truth. Components read via hooks and dispatch actions; no prop drilling for game state.

### Authentication Flow

`src/integrations/supabase/auth.jsx` provides `SupabaseProvider` context. The `useSupabaseAuth` hook gives `{ session, loading }`. App.jsx gates all game content behind auth—unauthenticated users see the Auth component.

While `loading` is true the app renders `BootScreen`, and that gate is longer
than it looks. Every returning player's stored access token has expired — they
last an hour — so restoring a session means a network refresh, and when the
backend is unreachable supabase-js retries with a back-off before giving up.
Measured: 8 requests over ~50 s, then the login screen. It does recover on its
own if the network returns mid-retry, so waiting is right; what BootScreen adds
is that the wait stops being silent (a hint at 6 s, a Reload button at 20 s).
`e2e/boot.spec.js` pins both the escalation and the recovery. BootScreen is
imported statically on purpose — a chunk for it would be a round-trip in front
of the screen whose job is covering a round-trip.

### Monetization

**Stripe Checkout** (real payments, not simulation):
- `supabase/functions/create-checkout-session/` — creates Stripe session, verifies JWT, validates origin
- `supabase/functions/stripe-webhook/` — handles `checkout.session.completed`, credits gems via `add_user_gems()` RPC
- `src/utils/stripe.js` — `redirectToStripeCheckout(bundleId)` gets user's JWT and calls edge function
- `src/components/PurchaseSuccess.jsx` — polls for webhook completion after return from Stripe

Gem bundles are defined server-side in the edge function (prices cannot be tampered client-side).

### Battle System

`src/components/GameBoard/GameBoard.jsx` handles the full battle loop:
- Phases: draw → main → battle → end
- Card abilities: taunt, piercing, shield, stealth, protect, fury
- `battleStatsRef` accumulates damage/healing/cardsPlayed per game for challenge tracking
- On game end, calls `recordBattleResult(won, damageDealt, healingDone, finalHP, cardsPlayed)`

**Summoning sickness.** A creature cannot attack on the turn it arrives. It
enters stamped `summoningSick` (shown as "Warming Up") and both per-turn flags
— `summoningSick` and `hasAttacked` — are lifted together by `readyCreatures()`
at its controller's next turn boundary; `canAttack(card)` is the single
predicate. Chuck's opening creature is stamped too, so neither side swings on
its first turn. Two traps to know about: the opponent-turn write-back must
re-ready its stale copy of the player's field or surviving creatures brick
permanently, and the opponent's field is readied *after* its attack wave, so
cards it played that turn still sit out the turn they arrived.

### Challenge System

Daily/weekly challenges use real stats from the store:
- `todayWins`, `todayBattles`, `todayDamageDealt`, `todayCardsPlayed` (reset daily)
- `weekWins`, `weekCoinsEarned` (reset Mondays)
- `claimedChallenges[]` persisted to prevent double-claiming

### Code Splitting & Bundle Weight

Vite config uses `manualChunks` for vendor/animations/ui/state/effects. The ten
dialogs (`Shop`, `BattlePass`, `Challenges`, …) **and `GameBoard`** are
lazy-loaded via `React.lazy()`. GameBoard matters: it is only reachable by
tapping Battle, but a static import put it and its tail — Howler,
canvas-confetti — on the boot path for everyone, and dragged the `effects`
chunk into index.html's modulepreload list.

Two non-obvious things keep the entry chunk small. Change either at your peril:

- **posthog-js is imported dynamically, after the key check** (`src/utils/analytics.js`).
  It is ~225 kB and does nothing without `VITE_POSTHOG_KEY`, so a static import
  shipped a quarter-megabyte of inert SDK to every visitor. Because the import
  now races startup, sends go through a bounded 50-entry buffer that flushes on
  load — events fired before it arrives are queued, not dropped.
- **`@supabase/realtime-js` and `@supabase/storage-js` are aliased to local
  stubs** in `vite.config.js` (`src/stubs/`). supabase-js imports both at module
  top level and constructs them eagerly, so ~85 kB of websocket and file-storage
  code shipped on first paint although this app only uses auth, `.from()` and
  `.rpc()`. **If you need Realtime or Storage, remove the alias** — the stubs
  throw with a message saying exactly that. `src/stubs/supabase-stubs.test.js`
  reads the installed supabase-js and fails if an upgrade starts importing or
  calling something the stubs do not provide.

Measured end to end, these took first-paint JS from 950.98 kB / 294.93 kB gzip
to 546.03 kB / 167.23 kB gzip.

Animations: the `animationsEnabled` store flag feeds `MotionConfig`'s
`reducedMotion` at the root (`src/main.jsx`), so one switch governs every
Framer Motion animation. The drifting menu teddies are deliberately CSS, not
Framer Motion — as JS-driven infinite animations they kept a phone's main
thread 57% busy on an idle menu.

### Card Art

Every card in `ALL_CARDS` carries three art-only fields — `fur`, `visual` and
`scene` — consumed exclusively by the generation scripts, never by the app.
`scripts/generate-card-art.mjs` builds a prompt from them and renders through a
self-hosted Fooocus/A1111 endpoint; `scripts/generate-card-art-diffusers.py` is
the no-endpoint fallback (huggingface diffusers, GPU-aware). Output is
`public/cards/<id>.webp` at 768x1024, which `TeddyCard`'s `ArtOrEmoji` slot
picks up automatically, falling back to emoji when a file is missing.
`scripts/art-monitor.mjs` serves a live progress dashboard, forced on during
any run. Full details in `public/cards/README.md`.

`src/stores/cardSchema.test.js` guards the catalog: it fails CI if a card has an
ability the engine does not implement, an effect `applySpecialEffect` cannot
resolve, or a missing/duplicate `visual` or `scene`.

### Path Aliases

- `@/` → `src/`
- `lib/` → project root `lib/`

### Supabase Edge Functions

Deploy with `supabase functions deploy <name>`. Required secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for JWT verification)
- `ALLOWED_ORIGIN` (production domain for CORS/redirect validation)

### Environment Variables

Frontend (Vite, must be prefixed with `VITE_`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_POSTHOG_KEY` (optional, for analytics). Leaving it unset does not just
  disable analytics — the posthog SDK is never downloaded at all, since the
  import happens after the key check.

For local edge-function development, also set `SUPABASE_SERVICE_ROLE_KEY` (used
by the Stripe webhook to credit gems) and deploy the webhook with JWT
verification disabled — `supabase functions deploy stripe-webhook --no-verify-jwt`
(also configured in `supabase/config.toml`) — since Stripe authenticates via
its signature header, not a Supabase JWT.
