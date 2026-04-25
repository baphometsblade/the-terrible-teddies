# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
npm run lint         # ESLint check (js,jsx files)
```

No test suite is configured.

## Architecture Overview

### Core Stack
- **React 18** + Vite (SPA, no SSR)
- **Zustand** with `persist` middleware for all game state (localStorage)
- **Supabase** for auth + edge functions + database
- **Framer Motion** for animations, **Howler.js** for sounds, **canvas-confetti** for effects

### State Management

All game state lives in `src/stores/gameStore.js`:
- Exports: `useGameStore`, `ALL_CARDS`, `ACHIEVEMENTS`, `DAILY_REWARDS`, `SHOP_ITEMS`
- Key fields: `coins`, `gems`, `xp`, `level`, `ownedCards`, `currentDeck`, `totalWins`, `currentWinStreak`
- Daily/weekly challenge stats auto-reset via date comparison in `recordBattleResult()`
- `pendingAchievements` queue (not persisted) for toast notifications

The store is the single source of truth. Components read via hooks and dispatch actions; no prop drilling for game state.

### Authentication Flow

`src/integrations/supabase/auth.jsx` provides `SupabaseProvider` context. The `useSupabaseAuth` hook gives `{ session, loading }`. App.jsx gates all game content behind auth—unauthenticated users see the Auth component.

### Monetization

**Stripe Checkout** (real payments, not simulation):
- `supabase/functions/create-checkout-session/` — creates Stripe session, verifies JWT, validates origin
- `supabase/functions/stripe-webhook/` — handles `checkout.session.completed`, credits gems via `add_user_gems()` RPC
- `src/utils/stripe.js` — `redirectToStripeCheckout(bundleId)` gets user's JWT and calls edge function
- `src/components/PurchaseSuccess.jsx` — polls for webhook completion after return from Stripe

Gem bundles are defined server-side in the edge function (prices cannot be tampered client-side).

### Battle System

`src/components/GameBoard/GameBoard.jsx` (890 lines) handles the full battle loop:
- Phases: draw → main → battle → end
- Card abilities: taunt, piercing, shield, stealth, protect, fury
- `battleStatsRef` accumulates damage/healing/cardsPlayed per game for challenge tracking
- On game end, calls `recordBattleResult(won, damageDealt, healingDone, finalHP, cardsPlayed)`

### Challenge System

Daily/weekly challenges use real stats from the store:
- `todayWins`, `todayBattles`, `todayDamageDealt`, `todayCardsPlayed` (reset daily)
- `weekWins`, `weekCoinsEarned` (reset Mondays)
- `claimedChallenges[]` persisted to prevent double-claiming

### Code Splitting

Vite config uses `manualChunks` for vendor/animations/ui/state/effects. Dialog components (`Shop`, `BattlePass`, `Challenges`, etc.) are lazy-loaded via `React.lazy()`.

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
- `VITE_SUPABASE_PROJECT_URL`
- `VITE_SUPABASE_API_KEY`
- `VITE_POSTHOG_KEY` (optional, for analytics)
