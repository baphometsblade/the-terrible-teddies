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
npm run art:og       # Render public/og-image.jpg, the link-preview picture
npm run art:icons    # Render the favicons, app icons and apple-touch-icon
```

`art:tokens` needs `pip install tokenizers` and is not in CI (it downloads a
model). Run it after editing any `scene` in `src/data/cardArt.js`: CLIP
silently discards everything past 77 tokens, and what it drops is the tail of
the prompt — exactly where the staging and the visual punchline live. The
script pins the text encoding as UTF-8 on purpose; decoding the em-dash each
prompt uses as cp1252 inflates counts by ~4 tokens and invents overruns that
are not there.

`art:og` and `art:icons` draw from the game itself (index.css's backdrop, the
Baloo 2 wordmark, shipped card art; `scripts/brand/`), photographed in
Playwright's Chromium and encoded with sharp. Re-run them when the wordmark,
the backdrop or those cards' art change. `art:og` fails if the image reaches
200 kB, past what every unfurler accepts; its alt text lives in
`src/lib/siteMeta.js`. `src/appIcons.test.js` checks every icon index.html and
the manifest declare against the files on disk.

Tests use **Vitest** (jsdom) and live next to the code as `*.test.js`, or
`*.test.jsx` for the ones that render a component (vitest.config.js sets
`esbuild: { jsx: 'automatic' }`, since the source never imports React for
JSX). The suite focuses on the pure, high-stakes logic — the `gameStore`
economy/money paths, `battleUtils` damage math, the opponent AI, the
deck/season helpers, the cloud save's decision table, and a `gemBundles`
guard that fails if the four gem price tables (Shop UI, checkout session,
webhook, analytics) ever drift. Run a single file with
`npx vitest run src/stores/gameStore.test.js`. A throwaway probe suite goes
under a dunder directory (`src/__probe__/`): vitest.config.js excludes
`src/__*__/**`, and anywhere else the include glob collects it into the real
run.

A second family of tests pins **claims against reality**, because prose and
data drift apart silently while code keeps compiling. Each derives what it
expects from the live tables rather than restating a number, so retuning the
game fails the build until the copy is retuned with it:
`Tutorial.test.js` (the tutorial must name every ability a card can actually
carry), `shopCopy.test.js` (no advertising exclusivity the pack pool does not
enforce; BEST VALUE must sit on the cheapest tier; no hand-written odds — the
store files are scanned, and every odds percentage on a rendered store screen
must come from `PACK_ODDS`), `cosmetics.test.js` (every `exclusive` the Battle
Pass sells must be renderable, or players pay for a no-op),
`supportCopy.test.js` (copy that sends a player to support must come with the
way there, `src/lib/support.js`), `tailwindShades.test.js` (a
class naming a shade the palette lacks generates no CSS and no error),
`csp.test.js` (vercel.json's script-src hash must match index.html's one
inline script, or the loader never leaves), `migrations.test.js` +
`scripts/check-migrations.sh` (the SQL must apply to a real Postgres and the
security properties must hold), and `stubs/supabase-stubs.test.js` (see Code
Splitting).

End-to-end tests (`npm run test:e2e`, Playwright, `e2e/`) boot the real app
hermetically (fake session seeded in localStorage, the fake Supabase project
and PostHog stubbed or aborted; the shared boot lives in
`e2e/helpers/session.js`). Fourteen specs: `smoke` (boot, a full battle turn
including an attack/exhaustion cycle, game over → Play Again,
shop/deck-builder/challenges, nested-dialog Escape, the cross-tab pickup),
`a11y` (axe-core, WCAG 2.1 A/AA, against every screen and dialog; fails on any
violation), `responsive` (no sideways scroll on any screen at 390px; the
menu's header controls on screen and Battle above the fold at 320x568,
360x640 and 375x553; the board fitted at phone sizes; every dialog within a
phone's width; the menu, toasts and the board's "← Menu" clear of an
installed iPhone's status bar), `targets` (every control a finger can meet is
44px either way, measured by what a finger meets rather than the box), `boot`
(BootScreen's escalation and recovery), `board`, `packs`, `battlepass`,
`collection-deck`, `meta-screens`, `money`, `cloud-save`, `password-reset` and
`shell` (Back, titles, focus between screens, the loader hand-off).

Two rules for writing them. **Motion is off by default**: playwright.config.js
sets `contextOptions: { reducedMotion: 'reduce' }`. A bare
`use.reducedMotion` is not a Playwright Test option and was silently ignored,
so for a long time the suite ran with motion on while its comment said
otherwise; a spec that needs motion opts back in with `contextOptions` or
`page.emulateMedia`. **Measure the settled page**: axe composites colours, so
an element caught mid-fade reports a blended colour rather than its resting
one, and an overlap check (a toast over a dialog's controls) is polled
(`expect.poll`) until the entrance has settled, since on a loaded machine the
first visible frame can still be moving. An overlap that persists still fails.

CI (`.github/workflows/node.js.yml`) runs lint, build, unit and e2e on every
PR to `main`, plus two jobs worth knowing about: `e2e-prod` reruns the smoke
spec against a real `vite preview` of `dist/` (a prod-only break — chunking,
minification, a stale CSP hash — is invisible to the dev-server run), and
`migrations` replays every SQL file against a postgres:16 service container and
asserts the resulting grants, because a migration Postgres refuses to apply is
invisible to every other gate.

## Architecture Overview

### Core Stack
- **React 18** + Vite (SPA, no SSR)
- **Zustand** with `persist` middleware for all game state (localStorage); the
  account keeps a copy of the save (see Cloud save), but the game always plays
  from the local store
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
- Exports: `useGameStore`, `ALL_CARDS`, `ACHIEVEMENTS`, `DAILY_REWARDS`,
  `SHOP_ITEMS`, `PACK_ODDS` / `PACK_SLOTS` / `rollRarity` (the pack roll),
  `BATTLE_XP`, `getXPForLevel`, `coinsForDuplicate`, `dailyClaimDay`, and for
  the cloud save and the reset: `SAVE_FIELDS`, `STARTING_GEMS`, `FRESH_START`,
  `keptThroughReset`, `normalizeSave`, `creditGems`, `serverCreditAt`,
  `scratchGameStore`
- Key fields: `coins`, `gems`, `gemDebt`, `xp`, `level`, `ownedCards`, `currentDeck`, `totalWins`, `currentWinStreak`
- Daily/weekly challenge stats roll over by date comparison, inline in
  `recordBattleResult()` and in `syncPeriods()` (on the menu's mount, and on a
  60 s tick while Challenges is open); the Battle Pass season in `syncSeason()`
  (from `addXP()` and every pass action, on the menu's mount, and when Card
  Packs or the Battle Pass opens). The cloud save runs the same two on a save
  it has just put in the store
- Three queues, none persisted (`partialize` drops them): `pendingAchievements`,
  `pendingLevelUps` (from `addXP`) and `pendingSeasonDeliveries` (from
  `syncSeason`). App drains each into a toast, deduped by id for StrictMode's
  second pass; the battle's result panel shows its own level-up and takes it
  off the queue (`dismissLevelUp`), so it is never said twice

The store is the single source of truth. Components read via hooks and dispatch actions; no prop drilling for game state.

`SAVE_FIELDS` is `Object.keys(initialState)`, and everything that copies a
save is built from it: the cloud save, the parked save, the backup. A field
added to `initialState` therefore travels to the account without anyone
remembering to add it — so a field that belongs to this device only goes in
`DEVICE_FIELDS` (`src/lib/saveBinding.js`), and any field with a shape gets a
repair in `normalizeSave`. That runs on a save stored under an earlier persist
`version` (its `migrate`) and on every save taken from the server, the
backup or a parked save.

**Two tabs.** persist serialises the whole partialized state on every `set`, so
tabs last-writer-wins over each other's entire save rather than per field — a
tab holding a stale snapshot reverted everything another had earned on its next
write, and the cloud save would then send that stale save to the account as an
ordinary change. `useRehydrateOnFocus` (`src/hooks/`) re-reads the save on
`focus` and `visibilitychange`, which necessarily precedes any interaction
that could write, and then runs `settlePendingPurchase()` (see Monetization)
so its reconcile lands on the fresh save. When localStorage still holds
exactly what this tab last wrote, the rehydrate is skipped: persist's
rehydrate replaces every array and object with a freshly parsed copy, so
running it as a "no-op" re-rendered every subscriber and changed every
array's identity. The cloud save does its own re-read before each decision
(invariant (e) under Cloud save), since a decision can also start without a
return to the tab (a retry timer, a token refresh, coming back online).
Deliberately *not* the `storage` event: that fires the moment the other tab
writes, which can land mid-render and swap state under a screen being read. Safe mid-battle — the battle lives in GameBoard's React
state, not the store, and is dealt from a snapshot (see Battle System) — and
`e2e/smoke.spec.js` pins both that and the cross-tab pickup.

### Cloud save

The account keeps a copy of the save (`player_saves`, through
`get_player_save` / `put_player_save`;
`supabase/migrations/20261023000000_cloud_saves_and_rank.sql`).
`src/lib/saveBinding.js` is on the boot path, because binding the store to an
account must happen the moment a session appears; `src/lib/cloudSave.js` (the
decision, the sending, Settings' status) is a lazy chunk, loaded with the
sign-in it serves. App keeps the loaded module in a variable so that sign-out
can stop it synchronously: a stop through a second `import()` raced the
sign-in's own and could land after the start.

**The sign-in order is load-bearing** (App's session effect, re-run on every
session change): `bindSaveToUser(uid)` first and synchronously (a different
account's save is parked if its account has not got it, then the store is
wiped for the newcomer, and a parked save of the newcomer's comes back), then
`ensurePlayerProfile` (independent of the save), then `startCloudSync`, whose
`onSettled` — and only that — runs `reconcileServerGems`. The reconcile
credits the server's purchase total above the save's `lastSyncedServerGems`
mark, and taking the account's save replaces that mark with the one matching
its gems, so it must see the mark of the save that will be played: reconciled
first, a fresh device (mark 0) re-credited every gem the account had ever
bought.

`decideSync` (rules in order, `cloudSave.test.js` pins each):
1. The account has no save: send this one (base rev 0).
2. The two are the same save: in step.
3. The account's save is one this device already has (last synced at that
   rev, or sent or taken since — the "seen" lineage): send this one.
4. This device has not changed since its last sync and the account has: take
   the account's. The calendar's own changes (`rollForward`) are not changes.
5. This device's save was never synced and holds nothing (no progress past a
   new save and nothing paid for, `isFreshSave`): take the account's.
6. Both changed: keep the one with more progress (`progressOf`: lifetime XP,
   plus a won battle's XP per different card owned, plus one per battle; this
   device's on a tie) and keep the other on this device as a backup Settings
   can switch to.

A decision that takes the account's save (rule 4 or 5, or rule 6 when the
account's has more progress), or keeps a backup (rule 6 either way), says so
in one queued toast, however many refusals it takes to land; an in-step check
or a plain send is silent.

Every write is a compare-and-swap on `rev`: a device that is behind is
refused, re-reads, and decides again (three refusals in a row back off).
Changes are sent `PUSH_DEBOUNCE_MS` (3 s) after the last one, and at once as
a keepalive request when the tab hides or the page goes. The client refuses
to send over 48 KiB of compact JSON (`CLOUD_SAVE_MAX_BYTES`); the server caps
at 64 KiB of its own JSON text (PT413), which prints wider. 'unavailable' —
the functions missing (404, PGRST202/205, 42883, 42P01), 42501 refusing the
user's own token (403; a 401 is the anon role, a session that a later
request will have), or an answer of the wrong shape — switches the cloud save
off for the rest of that sign-in: the game is exactly as local-only as it was
before, Settings says "Saved on this device only", and the gems are
reconciled on every session change as they were before cloud saves. If the
chunk itself fails to load, App reconciles and plays the save in hand.

Invariants that are easy to break:
- **(a)** A new `initialState` field travels unless it is in `DEVICE_FIELDS`
  or `BOOKKEEPING` (saveBinding.js). See State Management.
- **(b)** Any automatic store write that can run before the first decision (a
  mount effect, a rollover) must be one `rollForward` reproduces — add it to
  `ROLLOVERS` (cloudSave.js). Otherwise a device that is only behind looks
  like one that moved on: it is told "Two saves didn't match", and on a
  progress tie sends its old save over the account's.
- **(c)** No decision runs while a battle is in play
  (`html[data-screen="battle"]`, `battleInPlay()`) or while the tab is hidden;
  it waits for the battle's result or the tab's return. Mid-battle the
  hide-time send waits too, for GameBoard's pagehide listener (registered
  after cloudSave's) to book the abandoned battle's loss, which is then sent
  by itself.
- **(d)** Gems are reconciled only from `onSettled`, after a decision — never
  beside it.
- **(e)** `cloudSave` re-reads localStorage (`persist.rehydrate`) before every
  decision, and before noting a sync in a hidden tab (`commitMeta`), so it
  decides on what the tabs last wrote. Drop the re-read and a stale tab's
  copy is the one decided on — and sent to the account as an ordinary change.

The bookkeeping lives in two places on purpose. `cloudRev`, `cloudSyncedHash`
and `cloudSyncedAt` are in the save, so whatever replaces the save (the wipe,
an adopted save) replaces them with it: a wiped save that kept the last
account's rev would look in step with that account's save, and overwrite it.
The rest are localStorage keys beside the save — `terrible-teddies-` +
`cloud-seen` (the lineage; inside the save, a tab holding an old copy would
write old lineage back, since every tab writes the whole save),
`cloud-synced:<uid>` (the last synced save, which rule 4 rolls forward; kept
out so the save does not carry a copy of itself), `backup:<uid>` and
`parked:<uid>`. `resetProgress` keeps the three in-save fields, so a reset
reaches the account as an ordinary change rather than reading as a
never-synced empty save that rule 5 would replace with the pre-reset one.

App holds Daily Rewards and the first-run tutorial until the save is settled
for this sign-in (`saveReady`: the first decision has settled —
`whenFirstDecision(uid)` — or `SAVE_WAIT_MS`, 5 s, has passed with the tab in
view, counted afresh when a hidden tab returns). Before it, a new device
is playing the wiped save `bindToUser` left, and they opened on that. A
device that has never synced this account stays on BootScreen meanwhile, so
neither "Lv 1" nor Battle is offered on the wiped save.

Unit: `cloudSave.test.js`, `cloudSave.firstDecision.test.js`. Browser:
`e2e/cloud-save.spec.js`, with the save RPCs stubbed as the migration defines
them.

### Authentication Flow

`src/integrations/supabase/auth.jsx` provides `SupabaseProvider` context. The `useSupabaseAuth` hook gives `{ session, loading }`. App.jsx gates all game content behind auth—unauthenticated users see the Auth component.

While `loading` is true the app renders `BootScreen`, and that gate is longer
than it looks. Every returning player's stored access token has expired — they
last an hour — so restoring a session means a network refresh, and when the
backend is unreachable supabase-js retries with a back-off before giving up.
Measured: 8 requests over ~50 s, then the login screen. It does recover on its
own if the network returns mid-retry, so waiting is right; what BootScreen adds
is that the wait stops being silent (a hint at 6 s, a Reload button at 20 s).
BootScreen also covers the wait for the account's save on a device new to the
account (see Cloud save), as one gate, so its hint and Reload count the whole
wait. `e2e/boot.spec.js` pins both the escalation and the recovery. BootScreen
is imported statically on purpose — a chunk for it would be a round-trip in
front of the screen whose job is covering a round-trip.

Password reset: "Forgot password?" (`ForgotPassword`, lazy from `Auth.jsx`)
asks Supabase for a link back to the page's own origin. `src/lib/authLanding.js`
reads what the page load arrived with **at module load**, before supabase-js
consumes the recovery tokens and clears them from the URL (it raises no event
at all for a refused link). A recovery landing makes `SupabaseProvider` render
the lazy `PasswordRecovery` *in place of* App, not over it, so the game never
boots underneath with Daily Rewards and the menu wanting the keyboard; the
panel survives a reload of its tab (sessionStorage, for the hour the link's
session lasts). Supabase's Site URL, redirect allow-list and SMTP must be set
for any of it to work: DEPLOYMENT.md §1.

### The shell: Back, focus, safe areas

Navigation is React state (App's `currentScreen` and dialog flags), not URLs,
so the whole game was one history entry and the system Back left it — from an
open dialog, from the middle of a battle. `src/lib/historyGuard.js` keeps
**one** guard history entry for every open layer: `holdBack(onBack)` registers
a layer and returns its release, and Back goes to the top one. `useDialog`
holds Back for every dialog (in the same order as its Escape stack, so the two
agree on the top), App holds it for each screen but the menu (through the
Deck Builder's and GameBoard's `requestLeave()`, which ask before dropping
unsaved deck edits — a deck that is neither the battle deck nor a saved one —
or a live battle), and `DialogLoader` holds Back and Escape
for a dialog whose chunk is still in flight, so giving up on the spinner
closes the dialog it stands for. One entry, never one per layer: per-layer
entries broke on stacked layers (one layer's `history.back()` popstate closed
the next) and raced pushes against pending backs. Leaving the page from a
guard (the Shop's Stripe redirect) replaces the guard through the Navigation
API, so Back from Stripe lands on the game. A dialog opened with no user
gesture (Daily Rewards by itself) may not hold Back in Chrome, which skips
such entries.

`useDialog(onClose)` is the dialog contract: focus in on open (the first
control, or the one marked `data-autofocus` — the result panel's upsell sat
above Play Again), Tab trapped, Escape and Back to the top dialog only, focus
restored on close, and `html[data-dialog]` set while any is open (index.css
moves toasts off the dialog's controls). `src/lib/screenFocus.js`'s
`focusWhenReady` does the same between screens: onto the new screen's `h1`
(`[data-screen-root]`), or back on the menu onto the tile it was left by
(`[data-dest]`) — only when the focus has been lost, never taken from where
the player has put it, and not while a dialog is open. `document.title`
follows the screen (`SCREEN_TITLES` in App).

index.html opts into `viewport-fit=cover` with a black-translucent status bar,
so on an installed iPhone the clock, notch and home indicator sit over the
page. `src/lib/safeArea.js` holds the padding that clears them: **every
dialog scrim uses `SCRIM_PAD`** (the pack reveal adds `SCRIM_PAD_NARROW`
below 360px), the Collection and Deck Builder use `SCREEN_PAD`, the menu
`MENU_PAD`. They are utilities written out in full, not a rule in
`.dialog-scrim`, because a material's padding would lose to the scrim's `p-*`
utility and Tailwind only generates classes it can read whole. Sticky chrome
(the Collection's filter strip, the deck bar) keeps a keyboard-focused card
clear of itself through `src/lib/keepClear.js` — never page-level
`scroll-padding`, which also moved the page for the sticky chrome's own
controls.

The manifest's shortcuts arrive as `?action=battle|shop|rewards` (App reads
and strips it once signed in).

### Toasts

`src/components/ui/use-toast.js` shows **one toast at a time**
(`TOAST_LIMIT = 1`): they share one spot, and two covered what was under them
twice over. Two kinds share it:
- **Feedback** (the default: "Not enough energy!", "Deck Saved!") shows at
  once and replaces whatever is up, and is assertive to a screen reader
  (Radix `type: 'foreground'`): a rule refusing a move must be heard now.
- **Announcements** (`queue: true`: achievements, level-ups, season
  deliveries, cloud-save and late-payment notices) wait their turn, stay up
  for `readingTime(title, description)` (55 ms a character plus a second,
  4–10 s), and are polite (`'background'`). One that feedback interrupts goes
  back to the front of the line and is shown again whole.
- `dismiss()` with no id clears the spot and holds the line for
  `CLEAR_HOLD_MS` (1.5 s). GameBoard does this at every turn boundary, as it
  asks whether to leave and at game over. It never empties the line: it once
  did, and discarded every achievement a battle earned, since they are raised
  in the same moment as the game-over clear.

Placement (index.css, in the layer): on a phone **no toast takes a tap**
(`pointer-events: none` below 640px) — the list runs over each screen's
"← Menu", and a tap there focused the toast, which pauses its timer, so the
toast stayed up and the control under it stayed dead; F8 still reaches it.
Over a dialog (`html[data-dialog]`) the toast goes to the top-left corner,
the one place every dialog keeps clear of controls; on a phone it stops
4.75rem short of the right edge to clear the 44px `DialogClose`, and from sm
it is 21.5rem wide. Its budget there is a **one-line title** and two lines of
description above the first control under a dialog's header (the tutorial's
step bar at 320 is the highest), which is why App titles a season's delivery
"Season N rewards" and why that toast opts into `toast-clamp`; a longer title
has to be measured against `e2e/meta-screens.spec.js`. Escape over a dialog
closes the dialog only and the toast plays on (`leaveEscapeToDialog` in
toaster.jsx); a toast reached with F8 takes Escape itself, and the focus goes
back where F8 took it from. On the
battle board toasts sit on the measured centre line on phones and in the log
column from md (see Battle System); on the Deck Builder
(`html[data-screen="deck"]`) they lift clear of the deck bar between sm and
lg.

### Monetization

**Stripe Checkout** (real payments, not simulation):
- `supabase/functions/create-checkout-session/` — creates Stripe session, verifies JWT, validates origin
- `supabase/functions/create-checkout-session/checkoutGuards.js` — its
  security decisions, pure and tested: origin allowlisting (exact match only —
  `success_url` is built from it, so a prefix comparison would turn a completed
  checkout into an open redirect), own-property bundle lookup (a bare
  `TABLE[id]` returns a truthy function for `constructor`/`toString`, sails past
  the `!bundle` check and prices the session from `undefined`), and the
  one-per-account refusal. The gem table itself deliberately stays in
  `index.ts`, because `gemBundles.test.js` regex-parses it from there to guard
  price drift across all four tables: both edge functions' `GEM_BUNDLES`,
  `src/components/Shop.jsx`'s `GEM_BUNDLES` and `src/utils/purchaseAnalytics.js`'s
  `BUNDLE_PRICES` (the revenue event's value).
- `supabase/functions/stripe-webhook/` — handles `checkout.session.completed`
  and credits gems via `fulfill_gem_purchase()`, which records the purchase
  and credits it in one transaction (a failed credit rolls the row back, so
  Stripe's retry re-runs cleanly; a second delivery of the same session
  answers `duplicate`) and, for a one-per-account bundle, takes a per-account
  advisory lock and raises `PT409` for a second one.
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
     account's purchases hold one (`completed` or `disputed`). The Shop reads
     the account's rows by the same rule (`holdsBundle`) and shows the offer as
     Claimed, with no Buy button.
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
     tells the buyer why they were refunded. The `charge.refunded` that the
     webhook's own refund triggers reaches `reverse_gem_purchase`, which
     reverses only a `completed` row, so it changes nothing.
     `scripts/check-migrations.sh` runs two overlapping fulfilments to pin the
     lock (without it: 600 gems).
  Apply the migration before deploying `create-checkout-session`: its hold
  lookups fail closed (503, "you haven't been charged") for the starter until
  the SQL exists. It also needs `SUPABASE_SERVICE_ROLE_KEY`, which hosted edge
  functions get by default.
- `src/utils/stripe.js` — `redirectToStripeCheckout(bundleId)` gets user's JWT and calls edge function
- `src/components/PurchaseSuccess.jsx` — after the return from Stripe, checks
  for the webhook's row, backing off while it is pending (`pendingPollDelay`:
  4 s, then 15 s, then 30 s, about ten minutes in all) and saying what is true
  in each phase (pending, refunded, refunded as a duplicate, disputed). On
  landing it leaves a per-tab marker (`src/utils/pendingPurchase.js`,
  sessionStorage, a day's life) that `settlePendingPurchase()`
  (`src/hooks/settlePendingPurchase.js`) settles on each return to the tab, so
  a buyer who left the screen early still gets the gems without a reload — or
  hears why not. With `VITE_SUPPORT_EMAIL` set, the screen offers a mailto
  carrying the checkout reference.

Gem bundles are defined server-side in the edge function (prices cannot be tampered client-side).

Rules on the client side of the money:
- **Gems come in through `creditGems`, always.** A reversal whose gems were
  already spent leaves the rest owed (`gemDebt`, never negative; while it is
  above 0, `gems` is 0), and every way gems arrive — a purchase or a won
  dispute through `reconcileServerGems`, challenges, Battle Pass, login
  rewards — pays the debt first. Without it a buy → spend → chargeback → won
  dispute ended with the goods and the gems both. The purchase screens say
  where gems went when some paid a debt (`serverCreditAt`, `owedLine`).
- **`reconcileServerGems(balance, forUserId)`** credits only the rise above
  `lastSyncedServerGems` (spent gems are never restored by re-reading the
  server), applies a fall as a reversal, and drops a balance read for an
  account the save no longer belongs to (sign-out and sign-in mid-request on
  a shared device).
- **The revenue event fires once per checkout session**
  (`trackPurchaseOnce`, a localStorage mark per session id), whichever of the
  purchase screen and `settlePendingPurchase` sees it complete first.
- **Reset All Progress keeps what was paid for** (`keptThroughReset`: gems,
  gems owed, Premium and Legendary packs, a running Coin Doubler, cosmetics,
  this season's Premium Pass) and the claim ledgers that would otherwise let
  the same tiers and challenges be claimed again. Settings words its
  confirmation from the same object (`src/lib/resetSummary.js`), so the copy
  cannot promise more or less than the reset does.

### Store & progression

- **`StoreTile`** (`src/components/StoreTile.jsx`) is the one tile: the Shop
  and the Card Packs table both sell from `SHOP_ITEMS` through it, with
  `bestValuePackId` deriving where BEST VALUE goes. `useStoreBuy` buys a
  coin-priced item at once and **confirms every gem spend** (gems are real
  money and a spend cannot be undone); the Battle Pass's Premium unlock has its
  own confirm. Three guards, all needed: `ignoreKeyRepeat` on every buy
  control (Chrome clicks a focused button on each auto-repeat of a held Enter
  — one second bought sixteen Legendary packs), a 400 ms quiet window after a
  buy or a confirm closing (a double-click is two clicks), and
  `useArmedAfterOpen`, which keeps the confirm's own buttons dead for its first
  400 ms (the second click of the double-click that opened it landed on Buy).
  `ignoreKeyRepeat` and `useArmedAfterOpen` (with `DOUBLE_PRESS_MS`) live in
  `src/lib/keyRepeat.js`; the quiet window is `useStoreBuy`'s
  `REPEAT_BUY_MS` in `src/components/StoreTile.jsx`.
- **`PACK_ODDS` / `PACK_SLOTS`** are the table the pack roll uses (`rollRarity`)
  and the only source of posted odds: `src/components/PackOdds.jsx` renders the
  disclosure from them before purchase, and `shopCopy.test.js` fails on a
  hand-written percentage in the store files or on a rendered store screen.
- **`src/lib/battlePass.js`** is the reward table and its arithmetic, a data
  module with no store import (so the store can import it): the menu badges its
  tile from it on the boot path, the store delivers from it, Card Packs and the
  board's result panel name tiers from it. `claimBattlePassTier(tier, track)`
  checks eligibility in the store, never from the caller's render, and returns
  a receipt from `grantReward` (a card already owned pays duplicate coins, and
  the toast says so). `syncSeason()` delivers every tier reached but not
  claimed before it resets the pass, stamping the new season first so a second
  call delivers nothing, and queues the delivery on `pendingSeasonDeliveries`.
- **Cosmetics are permanent**: `unlockedCosmetics` survives the season change
  and the reset; only the pass's progress, claims and Premium are per season.

### Battle System

`src/components/GameBoard/GameBoard.jsx` handles the full battle loop:
- Phases: draw → main → end. There is no separate battle phase: as in
  Hearthstone, the player's turn is one phase in which they play cards and
  attack with ready creatures in any order. End Turn is the one turn control,
  glass while a move is left and brass once none is (`hasMoveLeft` in
  `GameBoard/turn.js`, which also owns `energyForTurn`)
- Card abilities: taunt, piercing, shield, stealth, protect, fury, swarm,
  royal; their rules text lives in `src/lib/abilities.js`
- `battleStatsRef` accumulates damage/healing/cardsPlayed/damageTaken per game for challenge tracking
- On game end, calls `recordBattleResult(won, damageDealt, healingDone, finalHP, cardsPlayed, damageTaken)`,
  which returns `{ xpGain, coinsGain, progress }` (`progress` is `addXP`'s
  account of the level, bar and bonus coins, which the result panel draws)

**A game is dealt from a snapshot.** The deck and the difficulty are read from
the store once, at the deal, keyed on `gameId` (Play Again bumps it). The deal
used to depend on the store's `currentDeck`, and every rehydrate (each focus
and return to the tab) puts a freshly parsed array there: one alt-tab re-dealt
the game in progress — a new hand, Chuck's crew at full HP, the log
restarted — under the same table and turn. Nothing the store does mid-game may
reach a game in progress; `GameBoard.test.jsx` and `e2e/smoke.spec.js` pin it.

**Summoning sickness.** A creature cannot attack on the turn it arrives. It
enters stamped `summoningSick` (shown as "Warming Up") and both per-turn flags
— `summoningSick` and `hasAttacked` — are lifted together by `readyCreatures()`
at its controller's next turn boundary; `canAttack(card)` is the single
predicate. Chuck's opening creature is stamped too, so neither side swings on
its first turn. Two traps to know about: the opponent-turn write-back must
re-ready its stale copy of the player's field or surviving creatures brick
permanently, and the opponent's field is readied *after* its attack wave, so
cards it played that turn still sit out the turn they arrived.

**Cards on the board.** `TeddyCard variant="board"` is the table layout: the
rows are zoomed to fit the felt (0.64 on a 320px phone), so the cost (paid)
and the rarity line (the frame says it) go, the stats become 28px badges, and
Taunt is a frame treatment. Small print grows with `legibleSize(px, zoom)` to
stay at 8px or more on screen, and below a row zoom of 0.8 the card drops its
name (`nameless`). That is safe only because every card's slot says it in
words — `describeCard` (`src/lib/abilities.js`) through GameBoard's
`CardWords`, name first where the card is content rather than a control — and
the face is aria-hidden. `attackDelta` is what a Royal ally adds right now
(the badge shows the attack the card hits for, emerald when raised, from
`StatBadge`'s `raisedBy`), as `costDelta` is Swarm's discount on the cost
coin; `resting` dims the art only, so a resting Taunt creature's frame keeps
its strength.

**The hand** overlaps as it grows (`fitHand`, measured), each card keeping a
visible strip of at least `HAND_MIN_STRIP` and never under 44 screen pixels
through the zoom; only past that does the strip scroll. On a touch screen the
first tap raises a hand card (and opens its preview) and only a second tap on
the raised card plays it, because overlapped cards hide their cost coins; a
held finger raises too and never plays. A mouse click, Enter, Space and a
screen reader's activation (a click with no finger behind it) still play at
once. **`CardPreview`** is the enlarged card, placed on the felt clear of the
row it was opened from (`previewPlacement.js`): hover (with a grace period so
the pointer can move onto it, WCAG 1.4.13), keyboard focus, the I key (which
reaches every card, tab stop or not), a held finger on a table card, or the
raise; Escape closes it. It is aria-hidden: the card's words already say it.
After a keyboard play, attack, Cancel, End Turn, Rally or Play Again, the
focus moves to the card now in that place, the next attacker or End Turn
(`refocusRef`) — but only if it was lost.

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
a live battle (which books a loss), and holds the cloud save's decisions
(see Cloud save). The board's screen-reader announcer is a `role="log"` of
recent entries, not one line of text — Chuck's turn writes several entries in
a single render.

Leaving a live battle — the board's own "← Menu", Concede, or the system Back
— asks first in `LeaveBattleDialog` (Keep playing is the focused default and
Escape). App's game screen renders no BackButton; GameBoard's ref exposes the
same `requestLeave()` for any other caller. A reload or close mid-battle books
the loss from GameBoard's pagehide listener.

### Challenge System

Daily/weekly challenges use real stats from the store:
- `todayWins`, `todayBattles`, `todayDamageDealt`, `todayCardsPlayed` (reset daily)
- `weekWins`, `weekCoinsEarned` (reset Mondays)
- `claimedChallenges[]` persisted to prevent double-claiming
- `syncPeriods()` stamps a never-anchored period without resetting it, and
  resets one whose stamp has moved on: an un-stamped week once left "Collect N
  New Cards" satisfied and re-claimable every rotation

### Code Splitting & Bundle Weight

Vite config uses `manualChunks` for animations/ui/state/effects (no `vendor`:
it never matched, and emitted a 1-byte file). `effects` is canvas-confetti
alone. **Howler is deliberately not in it**: its only importer is
`src/utils/sounds.js`, which only GameBoard imports, so Rollup keeps it in the
GameBoard chunk; grouped with confetti it downloaded with every dialog that
celebrates, Daily Rewards' once-a-day auto-open included.

The screens and dialogs are lazy-loaded via `React.lazy()`: `GameBoard`,
`DeckBuilder`, `TeddyCollection`, the nine dialogs (`Tutorial`,
`CardPackOpening`, `PlayerStats`, `Settings`, `DailyRewards`, `Shop`,
`BattlePass`, `Leaderboard`, `Challenges`) and `PurchaseSuccess`. GameBoard
matters most: it is only reachable by tapping Battle, but a static import put
it and its tail on the boot path for everyone, and dragged the `effects` chunk
into index.html's modulepreload list. Further lazy edges: `cloudSave`
(App, with the sign-in), `PasswordRecovery` (auth.jsx, a recovery landing
only), `ForgotPassword` (Auth.jsx), the drawn achievement toast
(`src/lib/achievementAnnouncements.js`, with the first unlock), and Daily
Rewards' card reveal (the Card Packs module, only on a day that draws cards).

`<Medallion>` (`src/components/ui/medallion.jsx`, on App's level-up toast)
and `<BrassCoin>` (`src/components/ui/coin.jsx`, on TeddyCard's cost, and
TeddyCard is on the menu) are leaf modules on purpose. `game-chrome.jsx`
re-exports both, but **anything on the boot path imports the leaf, never
game-chrome**: one such import put the whole of game-chrome in the entry
chunk. `coin.test.js` walks the static imports from `src/main.jsx` and fails
if game-chrome is reachable.

Two more non-obvious things keep the entry chunk small. Change either at your
peril:

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

Where it stands (`npm run build` with the checked-in `.env`, 2026-10-24): the
entry chunk is 286.60 kB / 87.07 kB gzip, and first-paint JS — the entry plus
the three chunks index.html modulepreloads (`animations`, `ui`, `state`) — is
574.15 kB / 181.46 kB gzip; CSS is 132.72 kB / 22.70 kB gzip. The GameBoard
chunk, Howler inside, is 104.59 kB / 33.02 kB gzip and `effects` 10.67 kB /
4.28 kB gzip. The entry inlines the Supabase URL and anon key, so the build
CI's `e2e-prod` job makes (the e2e test keys) reads about 0.4 kB smaller
(286.19 kB / 86.86 kB); compare like with like. Re-measure and read the gzip
column; a new chunk in index.html's modulepreload list, or a lazy module's
code turning up in `index-*.js`, is the thing to look for.

**Dependency advisories.** As of October 2026 `npm audit` reports 4 moderate,
all one advisory: postcss-selector-parser's quadratic parsing of flat
selectors (GHSA-rj75-hqrm-r3gf), reached through postcss-nested → tailwindcss
→ tailwindcss-animate, with no fix in Tailwind v3. It is a CPU-exhaustion bug
triggered by hostile selectors, the only selectors parsed are this repo's own
CSS at build time, and no emitted chunk contains the parser, so exposure is
nil; clearing it means Tailwind v4, which changes how the shipped CSS is
generated. Before treating a new advisory as player-facing, check whether it
reaches `dist/`: dompurify and fflate looked like they did, arriving through
posthog-js, but no emitted chunk contains either.

Animations: the `animationsEnabled` store flag feeds `MotionConfig`'s
`reducedMotion` at the root (`src/main.jsx`), so one switch governs every
Framer Motion animation. The drifting menu teddies are deliberately CSS, not
Framer Motion — as JS-driven infinite animations they kept a phone's main
thread 57% busy on an idle menu.

### Visual Materials

Screens are built from one set of surfaces in `src/index.css` ("the bar after
hours") rather than per-screen utility stacks: `.bar-backdrop` + a `.grain`
overlay for a full screen, `.panel-glass` for tiles and panels and
`.tile-glass` for a pressable tile (the same glass, lightening on hover: its
fill is a gradient image, so a hover `background-color` would sit under it
and never show), `.dialog-scrim` / `.dialog-panel` for overlays, `.btn-brass`
for the one primary action and `.btn-glass` for the rest, `.felt-table` /
`.table-rail` / `.hud-opponent` / `.hud-player` for the board, plus
`.trim-brass`, `.foil` / `.foil-epic`, `.sheen`, `.label-caps` and
`.text-brass-gradient`. Card frames come from `RARITY_METAL`
(`src/lib/rarity.js`). Three behavioural materials: `.game-surface` (no text
selection or iOS image callout on a surface played with the fingers — the
board, the pack reveal, the menu, the card grids — except inside inputs),
`.board-zoom` and `.card-zoom` (the hand, and the Collection and Deck Builder
grids, scaled with CSS `zoom`, not `transform`, so layout scales with them;
`src/lib/cardZoom.js` mirrors `.card-zoom`'s first breakpoint so the cards ask
for sharper art exactly when they are drawn larger, and `cardZoom.test.js`
keeps the two in step). And two
one-purpose lights: `.end-turn-ready` (End Turn's breath once no move is left)
and `.deck-slot-new` (the deck slot a card just filled glows once).

The chrome every dialog repeats is shared too — use it rather than a local
copy (the first round of screen redesigns each copied it, and the copies
drifted): `FOCUS_OUTLINE` / `FOCUS_RING` (`src/lib/focus.js`; outline on
anything carrying a material, ring only on plain elements); from
`src/components/ui/game-chrome.jsx`, `<DialogClose>` (every dialog's 44px
Close; the toast-over-dialog inset in index.css is measured against it),
`<BalanceChip>`, `<WalletChips>` (a store's balances, gems owed included),
`<PackBalanceChip>` and `<SectionHeading>`; `<Medallion>` and `<BrassCoin>`
(leaf modules, see Code Splitting; Medallion is aria-hidden, so a count drawn
on it needs sr-only text); the segmented control `.seg-well` / `.seg-on` /
`.seg-off`; the pack art in `src/components/PackArt.jsx`; and TeddyCard's
`dimmed` (greys the art only, for unowned cards). Confetti goes through
`celebrate()` (`src/lib/celebrate.js`), which honours the Animations switch
and reduced motion; canvas-confetti draws from JavaScript, so neither
MotionConfig nor the CSS rules reach it, and `celebrate.test.js` fails if
anything else imports it.

Rules that are easy to break:

- **They live in `@layer components`**, so a utility can refine a material.
  Outside the layer they land after Tailwind's utilities and win — a
  `.panel-glass` border once beat `border-l-[3px]` on the toast. The flip side:
  a utility always beats a material, so don't put one on the shadcn `<Button>`,
  whose default `bg-primary` replaces it. Use a plain `<button type="button">`.
- **Pseudo-elements are claimed.** `.grain`, `.foil`, `.sheen`, `.worn`,
  `.felt-print`, `.end-turn-ready` and `.deck-slot-new` use `::after`;
  `.trim-brass`, `.stitched` and `.stitched-plush` use `::before`. Two
  claimants on one element silently lose one. (`.foil-epic` only retunes
  `.foil`'s own `::after`; `.game-surface`, `.tile-glass` and the zooms use
  none.) The same list heads the materials section of index.css; keep the two
  identical.
- **No `backdrop-filter`, anywhere.** What sits behind a panel or a dialog
  keeps moving (the drifting menu teddies, rare-card foil), and a blur over
  moving content is recomputed every frame. Darker fills do the separating.
- **Light effects are CSS, transform/opacity only**, and stop under
  `[data-motion="off"]`, which `MotionPreference` mirrors from the Animations
  setting onto `<html>` (MotionConfig reaches only Framer Motion), and under
  `prefers-reduced-motion` (the rules after the layer).
- **Framer Motion owns `transform`** on anything it animates (x/y/scale/rotate):
  its inline style replaces a Tailwind `translate-*`/`scale-*` class on the same
  element. Centre with a plain wrapper. And never `whileTap`: it makes the
  element focusable, which once put a dead tab stop inside every card;
  `a11y.spec.js` now fails on any tab stop that is not a real control.
- **Every control is 44px** either way, the smallest comfortable touch target
  (`e2e/targets.spec.js`).

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

- `@/` → `src/` (vite.config.js, vitest.config.js and jsconfig.json)

### Supabase Edge Functions

Deploy with `supabase functions deploy <name>`. Required secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for JWT verification)
- `SUPABASE_SERVICE_ROLE_KEY` (the webhook credits gems with it, and
  `create-checkout-session` records the open starter checkout in
  `checkout_holds`; hosted functions get it by default)
- `ALLOWED_ORIGIN` (production domain for CORS/redirect validation)
- `DENO_ENV=production` (without it `create-checkout-session` also accepts
  the localhost dev origins)

### Environment Variables

Frontend (Vite, must be prefixed with `VITE_`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_POSTHOG_KEY` (optional, for analytics). Leaving it unset does not just
  disable analytics — the posthog SDK is never downloaded at all, since the
  import happens after the key check.
- `VITE_SITE_URL` (optional): the site's public address, from which the
  build's `social-meta` plugin (vite.config.js, `src/lib/siteMeta.js`) writes
  the absolute `og:url` / `og:image` / `twitter:image` tags a shared link
  needs. Unset, it falls back to Vercel's `VERCEL_PROJECT_PRODUCTION_URL`;
  with neither, the tags are left out with a build warning, not guessed. A
  value that is not an absolute http(s) URL fails the build.
- `VITE_SUPPORT_EMAIL` (optional): set, the purchase screens offer a mailto
  carrying the checkout reference; unset, they offer no address rather than
  an invented one (`src/lib/support.js`).

For local edge-function development, also set `SUPABASE_SERVICE_ROLE_KEY` and
deploy the webhook with JWT verification disabled —
`supabase functions deploy stripe-webhook --no-verify-jwt` (also configured
in `supabase/config.toml`) — since Stripe authenticates via its signature
header, not a Supabase JWT.
