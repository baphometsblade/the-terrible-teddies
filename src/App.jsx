import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import Auth from './components/Auth';
import MainMenu from './components/MainMenu';
import { Toaster } from "@/components/ui/toaster";
import { useToast, readingTime } from "@/components/ui/use-toast";
import { Medallion } from "@/components/ui/medallion";
import { Coins } from "lucide-react";
import ErrorBoundary from './components/ErrorBoundary';
import DialogErrorBoundary from './components/DialogErrorBoundary';
// Static, not lazy: this IS the boot path, so a chunk for it would be a
// round-trip in front of the screen whose entire job is covering a round-trip.
import BootScreen from './components/BootScreen';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from './stores/gameStore';
import { fetchServerGemBalance, ensurePlayerProfile, isSupabaseConfigured } from './utils/supabaseClient';
import analytics from './utils/analytics';
import { useRehydrateOnFocus } from './hooks/useRehydrateOnFocus';
import { FOCUS_OUTLINE } from './lib/focus';
import { SCREEN_PAD } from './lib/safeArea';
import { holdBack } from './lib/historyGuard';
import { focusWhenReady } from './lib/screenFocus';

// GameBoard is lazy for the same reason the dialogs are: it is only reachable
// after tapping Battle, but a static import put it — and its dependency tail,
// including Howler and canvas-confetti — on the boot path for every visitor.
// Measured: this moves 83 kB (25 kB gzip) off first paint, because it also
// drops the whole `effects` chunk out of index.html's modulepreload list.
const GameBoard = lazy(() => import('./components/GameBoard/GameBoard'));
// The two card screens likewise: each is one tile tap away, and imported
// statically they carried their whole UI (and its icons) in the entry chunk.
const DeckBuilder = lazy(() => import('./components/DeckBuilder'));
const TeddyCollection = lazy(() => import('./components/TeddyCollection'));
const Tutorial = lazy(() => import('./components/Tutorial'));
const CardPackOpening = lazy(() => import('./components/CardPackOpening'));
const PlayerStats = lazy(() => import('./components/PlayerStats'));
const Settings = lazy(() => import('./components/Settings'));
const DailyRewards = lazy(() => import('./components/DailyRewards'));
const Shop = lazy(() => import('./components/Shop'));
const BattlePass = lazy(() => import('./components/BattlePass'));
const Leaderboard = lazy(() => import('./components/Leaderboard'));
const Challenges = lazy(() => import('./components/Challenges'));
const PurchaseSuccess = lazy(() => import('./components/PurchaseSuccess'));

// Shown for the moment a lazy dialog or the board chunk is in flight. A CSS
// spin (transform only, on the compositor) rather than the Framer Motion
// repeat: Infinity it used to be, which ran on the main thread — the thread
// the arriving chunk needs. Stops with the Animations switch or reduced
// motion; the word says "loading" either way.
const DialogLoader = () => (
  <div className="fixed inset-0 z-50 dialog-scrim flex items-center justify-center" role="status">
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-white/10 border-t-brass-300 motion-safe:animate-spin" aria-hidden="true" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden="true">🧸</div>
      </div>
      <span className="label-caps text-plush-300">Loading</span>
    </div>
  </div>
);

// Each screen's name in the tab and the task switcher. The menu is the game's
// own name; signed out (and while booting) the page keeps index.html's
// fuller title, which is also what a search result shows.
const BASE_TITLE = typeof document !== 'undefined' ? document.title : '';
const SCREEN_TITLES = {
  menu: 'Terrible Teddies',
  game: 'Battle · Terrible Teddies',
  collection: 'Card Collection · Terrible Teddies',
  deck: 'Deck Builder · Terrible Teddies',
};

// The three drains below raise announcements (use-toast's `queue: true`):
// they arrive in bursts, and each used to replace the last, so all but one
// were cut short. Queued, they show one after another, each for its reading
// time. A battle's achievements arrive in the same moment as the board's
// game-over clear, in either order; the line survives that clear and picks
// up over the result dialog (use-toast's dismissToast).
const announceAll = (toast, items) => {
  items.forEach((t) => toast({ queue: true, ...t }));
};

// Hoisted to module scope for a stable identity. Declared inside App it was a
// fresh component type on every render, so any toast (which re-renders App)
// remounted the "← Menu" control mid-screen, replaying its mount and dropping
// keyboard focus. Takes its navigate handler as a prop.
// A plain button on the glass material (the shadcn Button's bg-primary is a
// utility and would beat it). Offset by the safe area so it clears a notch
// when the game is installed full-screen, as the screen's content is (its
// SCREEN_PAD), so the two keep their spacing. 44px tall, the smallest
// comfortable touch target, and the content starts 12px below it (pt-14).
const BackButton = ({ onClick }) => (
  <button
    type="button"
    className={`btn-glass absolute top-[calc(1rem+env(safe-area-inset-top))] left-[calc(1rem+env(safe-area-inset-left))] z-40 inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold ${FOCUS_OUTLINE}`}
    onClick={onClick}
  >
    ← Menu
  </button>
);

function App() {
  const { session, loading } = useSupabaseAuth();

  // Pick up anything another tab saved while this one was in the background,
  // before the player can act on a stale snapshot. See the hook for why focus
  // rather than the storage event.
  useRehydrateOnFocus();
  // The screen, and the one it was reached from (where the focus goes back
  // to). One state, so the two can never disagree.
  const [nav, setNav] = useState({ screen: 'menu', from: null });
  const currentScreen = nav.screen;
  const navigateTo = useCallback((screen) => {
    setNav((n) => (n.screen === screen ? n : { screen, from: n.screen }));
  }, []);
  // The Deck Builder's and the battle board's leave guards (each one's
  // requestLeave): "← Menu" and the system's Back go through them.
  const deckBuilderRef = useRef(null);
  const gameBoardRef = useRef(null);
  const signedIn = !!session;

  // The system's Back on any screen but the menu returns to the menu, as its
  // "← Menu" does: through the Deck Builder's unsaved-changes question, and
  // through the battle's leave question while a game is live (each screen's
  // requestLeave decides; before its chunk has loaded there is nothing to
  // ask about). It used to leave the game, from the middle of a battle
  // included. Dialogs hold Back above this (useDialog), so it reaches the
  // screen once they are closed. See src/lib/historyGuard.js.
  useEffect(() => {
    if (!signedIn || currentScreen === 'menu') return undefined;
    const guard = { game: gameBoardRef, deck: deckBuilderRef }[currentScreen];
    return holdBack(() => {
      if (guard?.current) guard.current.requestLeave();
      else navigateTo('menu');
    });
  }, [signedIn, currentScreen, navigateTo]);

  useEffect(() => {
    document.title = signedIn ? SCREEN_TITLES[currentScreen] ?? SCREEN_TITLES.menu : BASE_TITLE;
  }, [signedIn, currentScreen]);

  // The pre-JS loader (index.html) fades out over whatever React draws first.
  // Over BootScreen that is a matched cross-fade: the same medallion and
  // wordmark in the same place. But a session that restores at once takes
  // the app straight past BootScreen, and the loader's wordmark and medallion
  // then ghosted over the menu's cards for the half-second fade. Once past
  // BootScreen they go at once (index.html's .to-app), and only the backdrop,
  // which matches the screens', fades. A no-op once the loader has gone.
  useEffect(() => {
    if (!loading || !isSupabaseConfigured) {
      document.getElementById('initial-loader')?.classList.add('to-app');
    }
  }, [loading]);

  // The focus follows the player between screens: onto the new screen's
  // heading, and back on the menu onto the tile (or the Battle button) they
  // left it by. Only when it has been lost on the way (see screenFocus.js).
  useEffect(() => {
    if (!signedIn || !nav.from) return undefined;
    return focusWhenReady(nav.screen === 'menu'
      ? `[data-screen-root="menu"] [data-dest="${nav.from}"]`
      : `[data-screen-root="${nav.screen}"] h1`);
  }, [signedIn, nav]);

  const [showTutorial, setShowTutorial] = useState(false);
  const [showCardPacks, setShowCardPacks] = useState(false);
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [showShop, setShowShop] = useState(false);
  // The tab the Shop opens on: its Card Packs tab, unless a route to gems
  // (the Battle Pass confirm, the empty Card Packs table) sent the player.
  const [shopTab, setShopTab] = useState('packs');
  const [showBattlePass, setShowBattlePass] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);

  // Close every dialog at once — used by DialogErrorBoundary to return the app
  // to a usable state when a dialog chunk fails to load. Its result also keys
  // the boundary's reset, so opening any dialog re-attempts the chunk.
  const dialogFlags = [
    showTutorial, showCardPacks, showPlayerStats, showSettings, showDailyRewards,
    showShop, showBattlePass, showLeaderboard, showChallenges,
  ];
  const closeAllDialogs = () => {
    setShowTutorial(false); setShowCardPacks(false); setShowPlayerStats(false);
    setShowSettings(false); setShowDailyRewards(false); setShowShop(false);
    setShowBattlePass(false); setShowLeaderboard(false); setShowChallenges(false);
  };
  const [purchaseSessionId, setPurchaseSessionId] = useState(null);

  const openShop = (tab = 'packs') => { setShopTab(tab); setShowShop(true); };

  // A route from one dialog to another: close the first, and open the next
  // once the first has finished leaving (the dialogs' AnimatePresence reports
  // that below). Opened together, the next dialog noted the leaving one's
  // button as the place to hand focus back to, and the leaving one's own
  // cleanup then moved focus out from under the new one, onto the menu.
  // Sequenced, the first hands focus back to its menu tile and the next
  // takes it from there, so closing it lands the player where they began.
  const pendingRoute = useRef(null);
  const routeTo = (closeFrom, open) => {
    pendingRoute.current = open;
    closeFrom(false);
  };
  const runPendingRoute = () => {
    const open = pendingRoute.current;
    pendingRoute.current = null;
    open?.();
  };
  const toGems = (closeFrom) => routeTo(closeFrom, () => openShop('gems'));

  const { tutorialCompleted, setTutorialCompleted, lastLoginDate, pendingAchievements, reconcileServerGems, bindToUser } = useGameStore();
  const { toast } = useToast();

  // Show achievement unlock toasts — every queued achievement, one after another.
  //
  // Dedupe by id rather than cancelling timers in the effect cleanup. Draining
  // the queue below calls setState, which re-renders and re-runs this effect;
  // the old cleanup (`() => timers.forEach(clearTimeout)`) then fired on that
  // re-render and cancelled every toast timer it had just scheduled — so the
  // toasts NEVER appeared. The same cleanup also fired on StrictMode's
  // double-invoke. An id Set makes the drain idempotent instead: each
  // achievement is earned exactly once, so a second pass over the same batch
  // (StrictMode, or the drain re-render) schedules nothing and cancels nothing.
  const shownAchievementIds = useRef(new Set());

  // The Set is what makes the drain idempotent, but it outlives the data it
  // mirrors: App never unmounts (the auth gate swaps a subtree, it does not
  // remount the root), so after Settings' "reset progress" — or an account
  // switch on the same device, which bindToUser handles by wiping the save —
  // the store's completedAchievements is empty while this Set still holds every
  // id from the previous life. Re-earning them then schedules no toast at all.
  // Clear it whenever the ledger shrinks, which is exactly the wipe signal.
  const completedAchievementCount = useGameStore((s) => s.completedAchievements.length);
  const lastCompletedCount = useRef(completedAchievementCount);
  useEffect(() => {
    if (completedAchievementCount < lastCompletedCount.current) {
      shownAchievementIds.current = new Set();
    }
    lastCompletedCount.current = completedAchievementCount;
  }, [completedAchievementCount]);
  useEffect(() => {
    if (!pendingAchievements || pendingAchievements.length === 0) return;

    const fresh = pendingAchievements.filter((a) => !shownAchievementIds.current.has(a.id));
    useGameStore.setState({ pendingAchievements: [] });

    fresh.forEach((achievement) => shownAchievementIds.current.add(achievement.id));
    announceAll(toast, fresh.map((achievement) => ({
      title: `${achievement.icon} Achievement Unlocked!`,
      description: `${achievement.name} — +${achievement.reward.toLocaleString()} 🪙`,
    })));
  }, [pendingAchievements, toast]);

  // Level-ups earned away from a battle's result screen — a challenge's XP
  // reward, or a battle abandoned through "← Menu" — get a toast. Not while
  // the battle screen is up: its game-over panel shows the level-up and its
  // bonus coins itself, and takes the entry off the queue as it does, so the
  // player is never told twice. Deduped by id, like the achievements above,
  // so StrictMode's second effect pass (which still sees the old queue)
  // schedules nothing. Drawn as the result panel draws it (LevelUpRow): the
  // level struck on a medallion and a coin icon, not ⭐ and 🪙, which render
  // differently on every platform and read as stickers next to the UI.
  const pendingLevelUps = useGameStore((s) => s.pendingLevelUps);
  const shownLevelUpIds = useRef(new Set());
  useEffect(() => {
    if (currentScreen === 'game' || pendingLevelUps.length === 0) return;
    const fresh = pendingLevelUps.filter((l) => !shownLevelUpIds.current.has(l.id));
    useGameStore.setState({ pendingLevelUps: [] });
    fresh.forEach((levelUp) => shownLevelUpIds.current.add(levelUp.id));
    announceAll(toast, fresh.map((levelUp) => {
      const title = `Level ${levelUp.level}!`;
      const bonus = `+${levelUp.bonusCoins.toLocaleString()}`;
      return {
        title,
        icon: (
          <Medallion size="sm">
            <span className="font-display text-lg font-extrabold leading-none text-brass-200">{levelUp.level}</span>
          </Medallion>
        ),
        description: (
          <span className="inline-flex items-center gap-1">
            Level-up bonus: {bonus}
            <Coins className="h-4 w-4 text-brass-300" aria-hidden="true" strokeWidth={2.4} />
            <span className="sr-only">coins</span>
          </span>
        ),
        duration: readingTime(title, `Level-up bonus: ${bonus} coins`),
      };
    }));
  }, [pendingLevelUps, currentScreen, toast]);

  // What a season's end delivered (syncSeason hands over every Battle Pass
  // tier reached but not claimed, rather than dropping it as it used to). The
  // rollover runs on whichever screen notices the new season first — the
  // menu on launch, as a rule — so it is said here, once, deduped by id for
  // StrictMode's second pass.
  const pendingSeasonDeliveries = useGameStore((s) => s.pendingSeasonDeliveries);
  const shownDeliveryIds = useRef(new Set());
  useEffect(() => {
    if (pendingSeasonDeliveries.length === 0) return;
    const fresh = pendingSeasonDeliveries.filter((d) => !shownDeliveryIds.current.has(d.id));
    useGameStore.setState({ pendingSeasonDeliveries: [] });
    fresh.forEach((delivery) => shownDeliveryIds.current.add(delivery.id));
    announceAll(toast, fresh.map((delivery) => ({
      title: `${delivery.season} rewards delivered`,
      description: `Unclaimed when the season ended: ${delivery.summary}.`,
    })));
  }, [pendingSeasonDeliveries, toast]);

  // Tie analytics events to the signed-in user (or clear the identity on
  // logout) so purchases and funnels are measured per-user, not per-device.
  useEffect(() => {
    if (session?.user?.id) {
      analytics.identify(session.user.id);
    } else {
      analytics.reset();
    }
  }, [session]);

  // Sync player profile and gem balance from server on login
  useEffect(() => {
    if (!session) return;
    // Claim the save for this account FIRST, synchronously. The persisted
    // store is one device-wide key, so a different account signing in here
    // must not inherit the previous player's progress — or their
    // lastSyncedServerGems mark, which would make their next purchase credit
    // nothing. Must precede reconcileServerGems below.
    bindToUser(session.user?.id);

    const syncProfile = async () => {
      try {
        // Ensure player profile exists in database. Pass NO username: the
        // server then uses its anonymous 'Player_<8 uuid chars>' default rather
        // than the email local part, which used to be published to every player
        // on the leaderboard permanently. A chosen name is set explicitly via
        // set_player_username (PlayerStats rename).
        // Run together, and hand both the id we already have. These were
        // sequential and each opened with its own auth.getUser() round-trip, so
        // one login cost four serial requests — two of them re-fetching this
        // very user. Measured against the production build with Supabase at
        // 120 ms RTT, the reconcile finished 674 ms after first paint; passing
        // the id and parallelising takes it from 4 round-trips to 1.
        const uid = session.user?.id;
        const [, serverBalance] = await Promise.all([
          ensurePlayerProfile(null, uid),
          // Credit any gems purchased since our last sync (e.g. on another
          // device or a checkout whose success screen never loaded) without
          // restoring gems already spent locally.
          fetchServerGemBalance(uid),
        ]);
        // Pass the id this balance was read FOR. If the account has changed
        // while the request was in flight (sign out, sign in as someone else on
        // a shared device), the store drops it rather than crediting the new
        // player with the previous one's purchases.
        if (serverBalance !== null) {
          reconcileServerGems(serverBalance, uid);
        }
      } catch (err) {
        console.error('Profile sync failed:', err);
      }
    };
    syncProfile();
  }, [session, reconcileServerGems, bindToUser]);

  // Detect Stripe Checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');
    const sessionId = params.get('session_id');
    if (purchase === 'success' && sessionId) {
      setPurchaseSessionId(sessionId);
      // Clean URL without triggering a reload
      window.history.replaceState({}, '', window.location.pathname);
    } else if (purchase === 'cancelled') {
      // Short enough for one line under its title at 320: as two it reached
      // the first-run tutorial's step bar, which opens over the menu here.
      // Queued, so a launch's other announcements do not cut it short.
      toast({
        queue: true,
        title: 'Checkout cancelled',
        description: 'You weren’t charged.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  // Handle the manifest's app shortcuts (long-press the installed icon ->
  // Battle / Shop / Daily Rewards), which land here as ?action=<name>.
  useEffect(() => {
    if (!session) return;
    const action = new URLSearchParams(window.location.search).get('action');
    if (!action) return;
    if (action === 'battle') navigateTo('game');
    else if (action === 'shop') openShop();
    else if (action === 'rewards') setShowDailyRewards(true);
    window.history.replaceState({}, '', window.location.pathname);
  }, [session, navigateTo]);

  // Daily Rewards opens by itself once per player per day in a tab, claimed or
  // not. The reward waits for a tap now, so closing the panel unclaimed leaves
  // lastLoginDate behind, and this effect re-runs whenever the session object
  // changes, which supabase-js replaces on every return to the tab and every
  // hourly token refresh. Gated on lastLoginDate alone, the panel reopened over
  // whatever the player was doing, a battle or the tutorial included. After
  // the first time, the menu's glowing Daily rewards button carries it.
  const dailyAutoOpened = useRef(null);
  useEffect(() => {
    const today = new Date().toDateString();
    const key = `${session?.user?.id}|${today}`;
    // Don't auto-open daily rewards over an in-progress purchase verification;
    // stacked dialogs would fight for the keyboard. It opens after the buyer
    // dismisses the payment screen (purchaseSessionId clears → effect re-runs).
    if (session && lastLoginDate !== today && !purchaseSessionId && dailyAutoOpened.current !== key) {
      const timer = setTimeout(() => {
        dailyAutoOpened.current = key;
        setShowDailyRewards(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [session, lastLoginDate, purchaseSessionId]);

  useEffect(() => {
    if (session && !tutorialCompleted && !showDailyRewards && !purchaseSessionId) {
      const timer = setTimeout(() => setShowTutorial(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [session, tutorialCompleted, showDailyRewards, purchaseSessionId]);

  if (!isSupabaseConfigured) {
    return (
      <div className="relative min-h-screen bar-backdrop flex items-center justify-center p-6">
        <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-md text-center dialog-panel rounded-2xl p-8">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-night-950/60 ring-1 ring-brass-300/40 text-3xl" aria-hidden="true">🧸</div>
          <h1 className="font-display text-2xl font-extrabold text-white mb-2">Setup needed</h1>
          <p className="text-plush-200">
            The game isn&apos;t connected to its backend yet. Set
            <code className="mx-1 px-1.5 py-0.5 rounded bg-black/40 text-brass-200 text-sm">VITE_SUPABASE_URL</code>
            and
            <code className="mx-1 px-1.5 py-0.5 rounded bg-black/40 text-brass-200 text-sm">VITE_SUPABASE_ANON_KEY</code>
            in the environment, then reload.
          </p>
          <p className="text-plush-300 text-sm mt-3">See <code>.env.example</code> and <code>DEPLOYMENT.md</code>.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <BootScreen />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'game':
        return (
          <div className="relative">
            {/* No BackButton here: the board draws its own "← Menu", because
                leaving a live battle books a loss and the board is what knows
                whether one is live (and asks first if so).

                Same Suspense + error-boundary treatment the lazy dialogs get.
                The board chunk is fetched on the tap that navigates here, so
                the spinner is typically a single frame.

                The boundary is not optional: Suspense catches the *pending*
                import promise, never a *rejected* one, so a battle chunk that
                fails to arrive (flaky network, stale hash after a deploy)
                would throw all the way to the app-level ErrorBoundary and
                replace the entire app with the fatal crash screen. Scoped
                here, a failed Battle tap is a dismissible notice that drops
                the player back on the menu. resetKey is the screen, so
                navigating away and tapping Battle again refetches the chunk
                instead of being stuck on the failure. */}
            <DialogErrorBoundary resetKey={currentScreen} onDismiss={() => navigateTo('menu')}>
              <Suspense fallback={<DialogLoader />}>
                <GameBoard
                  ref={gameBoardRef}
                  onBackToMenu={() => navigateTo('menu')}
                  onOpenShop={() => { navigateTo('menu'); openShop(); }}
                />
              </Suspense>
            </DialogErrorBoundary>
          </div>
        );
      case 'deck':
        return (
          <div className={`relative min-h-screen bar-backdrop ${SCREEN_PAD}`}>
            <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
            {/* The builder guards its own way out: with edits that are not
                the battle deck yet it asks before they are dropped. Until its
                chunk has loaded (or if it failed to) there is nothing to
                lose, and the button just leaves. */}
            <BackButton
              onClick={() => (deckBuilderRef.current ? deckBuilderRef.current.requestLeave() : navigateTo('menu'))}
            />
            <div className="relative pt-14">
              <DialogErrorBoundary resetKey={currentScreen} onDismiss={() => navigateTo('menu')}>
                <Suspense fallback={<DialogLoader />}>
                  <DeckBuilder ref={deckBuilderRef} onBackToMenu={() => navigateTo('menu')} />
                </Suspense>
              </DialogErrorBoundary>
            </div>
          </div>
        );
      case 'collection':
        return (
          <div className={`relative min-h-screen bar-backdrop ${SCREEN_PAD}`}>
            <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
            <BackButton onClick={() => navigateTo('menu')} />
            <div className="relative pt-14">
              <DialogErrorBoundary resetKey={currentScreen} onDismiss={() => navigateTo('menu')}>
                <Suspense fallback={<DialogLoader />}>
                  <TeddyCollection />
                </Suspense>
              </DialogErrorBoundary>
            </div>
          </div>
        );
      case 'menu':
      default:
        return (
          <MainMenu
            onStartGame={() => navigateTo('game')}
            onDeckBuilder={() => navigateTo('deck')}
            onCollection={() => navigateTo('collection')}
            onTutorial={() => setShowTutorial(true)}
            onCardPacks={() => setShowCardPacks(true)}
            onPlayerStats={() => setShowPlayerStats(true)}
            onSettings={() => setShowSettings(true)}
            onDailyRewards={() => setShowDailyRewards(true)}
            onShop={() => openShop()}
            onBattlePass={() => setShowBattlePass(true)}
            onLeaderboard={() => setShowLeaderboard(true)}
            onChallenges={() => setShowChallenges(true)}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      <div className="App min-h-screen">
        {session ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScreen}
                // What the focus hand-off above looks for.
                data-screen-root={currentScreen}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {renderScreen()}
              </motion.div>
            </AnimatePresence>

            <DialogErrorBoundary resetKey={dialogFlags.join()} onDismiss={closeAllDialogs}>
            <Suspense fallback={<DialogLoader />}>
              {/* Keyed, so AnimatePresence can tell one dialog from another: keyless,
                  every dialog had the key "" and one leaving as another arrived
                  (a route) read as the same child staying. */}
              <AnimatePresence onExitComplete={runPendingRoute}>
                {showTutorial && (
                  <Tutorial
                    key="tutorial"
                    onClose={() => {
                      setShowTutorial(false);
                      setTutorialCompleted(true);
                    }}
                    onStartGame={() => {
                      setShowTutorial(false);
                      setTutorialCompleted(true);
                      navigateTo('game');
                    }}
                  />
                )}

                {/* The empty table names where packs come from; these are the
                    routes there that exist. */}
                {showCardPacks && (
                  <CardPackOpening
                    key="card-packs"
                    onClose={() => setShowCardPacks(false)}
                    onGetGems={() => toGems(setShowCardPacks)}
                    onBattlePass={() => routeTo(setShowCardPacks, () => setShowBattlePass(true))}
                    onDailyRewards={() => routeTo(setShowCardPacks, () => setShowDailyRewards(true))}
                  />
                )}
                {showPlayerStats && <PlayerStats key="player-stats" onClose={() => setShowPlayerStats(false)} />}
                {showSettings && <Settings key="settings" onClose={() => setShowSettings(false)} />}
                {showDailyRewards && <DailyRewards key="daily-rewards" onClose={() => setShowDailyRewards(false)} />}
                {showShop && <Shop key="shop" initialTab={shopTab} onClose={() => setShowShop(false)} />}
                {showBattlePass && (
                  <BattlePass
                    key="battle-pass"
                    onClose={() => setShowBattlePass(false)}
                    onGetGems={() => toGems(setShowBattlePass)}
                  />
                )}
                {showLeaderboard && <Leaderboard key="leaderboard" onClose={() => setShowLeaderboard(false)} />}
                {showChallenges && <Challenges key="challenges" onClose={() => setShowChallenges(false)} />}
              </AnimatePresence>
            </Suspense>
            </DialogErrorBoundary>
          </>
        ) : (
          <Auth />
        )}

        {/* Purchase verification renders regardless of auth state: returning
            from Stripe is a full page navigation, so if session restoration is
            slow or fails the buyer must still see confirmation rather than a
            bare login screen with their paid session_id silently dropped. */}
        {purchaseSessionId && (
          <DialogErrorBoundary resetKey={purchaseSessionId} onDismiss={() => setPurchaseSessionId(null)}>
            <Suspense fallback={<DialogLoader />}>
              <PurchaseSuccess
                sessionId={purchaseSessionId}
                onDone={() => setPurchaseSessionId(null)}
              />
            </Suspense>
          </DialogErrorBoundary>
        )}

        <Toaster />
      </div>
    </ErrorBoundary>
  );
}

export default App;
