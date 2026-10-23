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

**Two tabs.** persist serialises the whole partialized state on every `set`, so
tabs last-writer-wins over each other's entire save rather than per field — a
tab holding a stale snapshot reverted everything another had earned on its next
write. `useRehydrateOnFocus` (`src/hooks/`) re-reads the save on `focus` and
`visibilitychange`, which necessarily precedes any interaction that could write.
Deliberately *not* the `storage` event: that fires the moment the other tab
writes, which can land mid-render and swap state under a screen being read.
Safe mid-battle — the battle lives in GameBoard's React state, not the store —
and `e2e/smoke.spec.js` pins both that and the cross-tab pickup.

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
- `supabase/functions/create-checkout-session/checkoutGuards.js` — its two
  security decisions, pure and tested: origin allowlisting (exact match only —
  `success_url` is built from it, so a prefix comparison would turn a completed
  checkout into an open redirect) and own-property bundle lookup (a bare
  `TABLE[id]` returns a truthy function for `constructor`/`toString`, sails past
  the `!bundle` check and prices the session from `undefined`). The gem table
  itself deliberately stays in `index.ts`, because `gemBundles.test.js`
  regex-parses it from there to guard price drift across all four tables.
- `supabase/functions/stripe-webhook/` — handles `checkout.session.completed`, credits gems via `add_user_gems()` RPC.
  It also reverses on `charge.refunded` (full refunds only) and on
  `charge.dispute.created` / `charge.dispute.updated` /
  `charge.dispute.funds_withdrawn` — but only for a dispute status that means
  the money is gone (an allowlist: `needs_response`, `under_review`, `lost`,
  `charge_refunded`). A `warning_*` status is an inquiry Stripe takes no money
  for, and `won` must never reverse: Stripe reports a dispute resolved in our
  favour as an ordinary `updated`, and the original "anything not warning_*"
  rule debited customers for winning. `updated` matters because an inquiry
  that escalates into a real chargeback is reported as an update, not a second
  `created`. `charge.dispute.closed` (won)
  and `charge.dispute.funds_reinstated` put the gems back via
  `restore_gem_purchase()`; without them a reversal is permanent, since
  fulfillment is idempotent on `stripe_session_id` and cannot re-credit.
- `supabase/functions/stripe-webhook/eventRouting.js` — the decision layer
  (which event means fulfil / reverse / restore / ignore), extracted as pure JS
  with no Deno or network imports so Vitest can reach it. `vitest.config.js`
  includes `supabase/functions/**/*.test.js` for exactly this. Four separate
  money bugs have lived in those few branches — disputes reversed
  unconditionally, no restoration at all, restoration accepting refunds, and the
  inquiry-to-chargeback escalation unhandled — and every one was a wrong answer
  to a question with no side effects, which is to say unit-testable. Add a
  branch here, add a case to `eventRouting.test.js`; there is no Deno in CI, so
  this is the only gate that covers it.
- **One Starter Gem Pack per account** (`ONE_PER_ACCOUNT_BUNDLES` in
  `checkoutGuards.js`, mirrored by `one_per_account_bundle()` in SQL;
  `checkoutGuards.test.js` fails if the two lists drift). Three layers, from
  `20261023000100_one_starter_per_account.sql`:
  1. `create-checkout-session` refuses (409 `already_purchased`) once the
     account's purchases hold one (`completed` or `disputed`).
  2. Purchases only show a payment once it is fulfilled, so a buyer with two
     starter checkouts open could pay both. `checkout_holds` records the
     account's open starter session (service role only; no client role can
     touch it). While Stripe says it is `open`, the function hands back that
     same URL; `complete` answers 409; `expired`, or unknown to Stripe, is
     replaced. Starter sessions get `expires_at` 31 minutes out (Stripe's floor
     is 30), so an abandoned one frees up quickly. Two requests racing both
     create a session; the hold's primary key lets one record it, and the
     other expires its own (never handed out) and returns the winner's.
  3. The airtight one: `fulfill_gem_purchase` takes a per-account advisory
     lock and RAISEs `PT409` (`one_per_account_already_held`) for a second
     starter. The webhook (`stripe-webhook/duplicateRefund.js`, pure and
     tested) recognises it, refunds the whole payment through Stripe
     (idempotency key per session; `charge_already_refunded` counts as done),
     then records the row as `refunded_duplicate` (no gems). Refund first,
     record second, 500 on either failing, so Stripe's redelivery finishes the
     job. It RAISEs rather than returns so that a webhook deployed before the
     migration answers 500 and keeps the event alive, instead of acking a paid
     session with no gems and no refund. `refunded_duplicate` is neither
     reversible nor restorable, does not hold the offer, and PurchaseSuccess
     tells the buyer why they were refunded. `scripts/check-migrations.sh`
     runs two overlapping fulfilments to pin the lock (without it: 600 gems).
  Apply the migration before deploying `create-checkout-session`: its hold
  lookups fail closed (503, "you haven't been charged") for the starter until
  the SQL exists. It also needs `SUPABASE_SERVICE_ROLE_KEY`, which hosted edge
  functions get by default.
- `src/utils/stripe.js` — `redirectToStripeCheckout(bundleId)` gets user's JWT and calls edge function
- `src/components/PurchaseSuccess.jsx` — polls for webhook completion after return from Stripe

Gem bundles are defined server-side in the edge function (prices cannot be tampered client-side).

### Battle System

`src/components/GameBoard/GameBoard.jsx` handles the full battle loop:
- Phases: draw → main → end. There is no separate battle phase: as in
  Hearthstone, the player's turn is one phase in which they play cards and
  attack with ready creatures in any order. End Turn is the one turn control,
  glass while a move is left and brass once none is (`hasMoveLeft` in
  `GameBoard/turn.js`, which also owns `energyForTurn`)
- Card abilities: taunt, piercing, shield, stealth, protect, fury, swarm,
  royal; their rules text lives in `src/lib/abilities.js`
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

Two runtime dependencies were also removed outright, because nothing consumed
them: **react-router-dom** (no `Route`, `Link`, `useNavigate` or `useParams`
anywhere — navigation is the `currentScreen` state in `App`) and
**@tanstack/react-query** (no `useQuery` at all; the client existed only so
`auth.jsx` could `invalidateQueries('user')`, a key nothing had registered).
Removing both took the entry chunk from 273.19 kB / 78.07 kB gzip to
243.30 kB / 69.19 kB gzip. Don't re-add either without a consumer.

**Dependency advisories.** As of October 2026 `npm audit` reports 8, all
through Tailwind CSS v3's file watcher and globbing (`braces`, `chokidar`,
`micromatch`, `fast-glob`, `postcss-selector-parser`, …). They are
denial-of-service bugs triggered by hostile glob patterns, and the only
patterns here are this repo's own Tailwind config, so exposure is nil; clearing
them means Tailwind v4, which changes how the shipped CSS is generated. Before
treating a new advisory as player-facing, check whether it reaches `dist/`:
dompurify and fflate looked like they did, arriving through posthog-js, but
no emitted chunk contains either.

Animations: the `animationsEnabled` store flag feeds `MotionConfig`'s
`reducedMotion` at the root (`src/main.jsx`), so one switch governs every
Framer Motion animation. The drifting menu teddies are deliberately CSS, not
Framer Motion — as JS-driven infinite animations they kept a phone's main
thread 57% busy on an idle menu.

### Visual Materials

Screens are built from one set of surfaces in `src/index.css` ("the bar after
hours") rather than per-screen utility stacks: `.bar-backdrop` + a `.grain`
overlay for a full screen, `.panel-glass` for tiles and panels,
`.dialog-scrim` / `.dialog-panel` for overlays, `.btn-brass` for the one
primary action and `.btn-glass` for the rest, `.felt-table` / `.table-rail` /
`.hud-opponent` / `.hud-player` for the board, plus `.trim-brass`, `.foil` /
`.foil-epic`, `.sheen`, `.label-caps` and `.text-brass-gradient`. Card frames
come from `RARITY_METAL` (`src/lib/rarity.js`).

The chrome every dialog repeats is shared too — use it rather than a local
copy (the first round of screen redesigns each copied it, and the copies
drifted): `FOCUS_OUTLINE` / `FOCUS_RING` (`src/lib/focus.js`; outline on
anything carrying a material, ring only on plain elements), `<Medallion>` and
`<BalanceChip>` (`src/components/ui/game-chrome.jsx`; Medallion is
aria-hidden, so a count drawn on it needs sr-only text), the segmented control
`.seg-well` / `.seg-on` / `.seg-off`, the pack art in
`src/components/PackArt.jsx`, and TeddyCard's `dimmed` (greys the art only,
for unowned cards). Confetti goes through `celebrate()` (`src/lib/celebrate.js`),
which honours the Animations switch and reduced motion; canvas-confetti draws
from JavaScript, so neither MotionConfig nor the CSS rules reach it, and
`celebrate.test.js` fails if anything else imports it.

Rules that are easy to break:

- **They live in `@layer components`**, so a utility can refine a material.
  Outside the layer they land after Tailwind's utilities and win — a
  `.panel-glass` border once beat `border-l-[3px]` on the toast. The flip side:
  a utility always beats a material, so don't put one on the shadcn `<Button>`,
  whose default `bg-primary` replaces it. Use a plain `<button type="button">`.
- **Pseudo-elements are claimed.** `.grain`, `.foil`, `.sheen`, `.worn` and
  `.felt-print` use `::after`; `.trim-brass`, `.stitched` and `.stitched-plush`
  use `::before`. Two claimants on one element silently lose one.
- **No `backdrop-filter`, anywhere.** What sits behind a panel or a dialog
  keeps moving (the drifting menu teddies, rare-card foil), and a blur over
  moving content is recomputed every frame. Darker fills do the separating.
- **Light effects are CSS, transform/opacity only**, and stop under
  `[data-motion="off"]`, which `MotionPreference` mirrors from the Animations
  setting onto `<html>` (MotionConfig reaches only Framer Motion).
- **Framer Motion owns `transform`** on anything it animates (x/y/scale/rotate):
  its inline style replaces a Tailwind `translate-*`/`scale-*` class on the same
  element. Centre with a plain wrapper. And never `whileTap`: it makes the
  element focusable, which once put a dead tab stop inside every card;
  `a11y.spec.js` now fails on any tab stop that is not a real control.

The battle board is a fixed-height flex column (rails, table, controls,
hand). The two card rows are fitted to the felt by measurement — `fitField`
in GameBoard, a ResizeObserver that sets their CSS `zoom` — because
viewport-height breakpoints cannot see a phone's browser toolbars or the
control row wrapping, and with them the player's row spilled onto End Turn.
`e2e/responsive.spec.js` pins this at real phone viewport sizes. Two things
keep the measurement honest: the board's height must stay definite (the felt
is measured from it), and anything that can appear mid-turn — status chips,
the targeting prompt, the controls on Chuck's turn — reserves its space, or
the table resizes under the player's finger. The hand steps down by viewport
height (`.board-zoom`). With a mouse the board keeps at least 640px and
scrolls past that, so zooming the browser in does not shrink the cards;
landscape phones get a "turn your phone upright" card (`.rotate-hint`).

**Combat feedback** (floating numbers, hit shake and flash, the attacker's
lunge, the crumple on death, the face-hit vignette, the turn banner) is driven
by short-lived events from `pushFx` and drawn by the cards and meters
themselves (`FieldSlot`, `HealthMeter`), which read them through `FxContext`.
Context rather than props on purpose: a creature that dies stays on screen for
its exit, rendered by AnimatePresence from props frozen *before* the killing
blow, and only a context still reaches it. An earlier version drew numbers at
each card's captured screen position instead; that went stale whenever a row
re-centred, and in WebKit builds whose client rects ignore CSS `zoom` it put
numbers on the wrong card. No game state waits on any effect; the battle log
stays the accessible record, every effect is aria-hidden, and all of it stops
with the Animations switch and reduced motion. The field rows'
`AnimatePresence` is keyed by `gameId`, so Play Again does not play the last
game's cards out as if they had died.

While a game is in play GameBoard sets `html[data-screen="battle"]`, which
moves toasts off the controls: onto the measured centre line on phones
(`--battle-centre-y`), and from md up into room at the top of the log column
that the log steps down to make (GameBoard measures the toast list), so a toast
covers neither the log, the controls nor the cards. Battle toasts are only for
what the board cannot show — a rule refusing a move, or a legal play that did
nothing ("Already fully stuffed"); a play, a hit, a kill or a heal is drawn on
the table and written to the log, and a toast repeating it is noise. The same
attribute turns off `overscroll-behavior`, so a pull-to-refresh cannot reload
a live battle (which books a loss). The board's
screen-reader announcer is a `role="log"` of recent entries, not one line of
text — Chuck's turn writes several entries in a single render.

Leaving a live battle — the board's own "← Menu" or Concede — asks first in
`LeaveBattleDialog` (Keep playing is the focused default and Escape). App's
game screen renders no BackButton; GameBoard's ref exposes the same
`requestLeave()` for any other caller.

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
