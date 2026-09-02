import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import Auth from './components/Auth';
import MainMenu from './components/MainMenu';
import DeckBuilder from './components/DeckBuilder';
import TeddyCollection from './components/TeddyCollection';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import ErrorBoundary from './components/ErrorBoundary';
import DialogErrorBoundary from './components/DialogErrorBoundary';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from './stores/gameStore';
import { fetchServerGemBalance, ensurePlayerProfile, isSupabaseConfigured } from './utils/supabaseClient';
import analytics from './utils/analytics';

// GameBoard is lazy for the same reason the dialogs are: it is only reachable
// after tapping Battle, but a static import put it — and its dependency tail,
// including Howler and canvas-confetti — on the boot path for every visitor.
// Measured: this moves 83 kB (25 kB gzip) off first paint, because it also
// drops the whole `effects` chunk out of index.html's modulepreload list.
const GameBoard = lazy(() => import('./components/GameBoard/GameBoard'));
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

const DialogLoader = () => (
  <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="text-6xl"
    >
      🧸
    </motion.div>
  </div>
);

// Hoisted to module scope for a stable identity. Declared inside App it was a
// fresh component type on every render, so any toast (which re-renders App)
// remounted the "← Menu" control mid-screen, replaying its mount and dropping
// keyboard focus. Takes its navigate handler as a prop.
const BackButton = ({ onClick }) => (
  <Button
    className="absolute top-4 left-4 z-40 bg-night-700 hover:bg-night-600 border border-plush-700/60 text-plush-100"
    onClick={onClick}
  >
    ← Menu
  </Button>
);

function App() {
  const { session, loading } = useSupabaseAuth();
  const [currentScreen, setCurrentScreen] = useState('menu');

  const [showTutorial, setShowTutorial] = useState(false);
  const [showCardPacks, setShowCardPacks] = useState(false);
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [showShop, setShowShop] = useState(false);
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

  const { tutorialCompleted, setTutorialCompleted, lastLoginDate, pendingAchievements, reconcileServerGems, bindToUser } = useGameStore();
  const { toast } = useToast();

  // Show achievement unlock toasts — process ALL queued achievements with staggered timing.
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
  useEffect(() => {
    if (!pendingAchievements || pendingAchievements.length === 0) return;

    const fresh = pendingAchievements.filter((a) => !shownAchievementIds.current.has(a.id));
    useGameStore.setState({ pendingAchievements: [] });

    fresh.forEach((achievement, i) => {
      shownAchievementIds.current.add(achievement.id);
      setTimeout(() => {
        toast({
          title: `${achievement.icon} Achievement Unlocked!`,
          description: `${achievement.name} — +${achievement.reward.toLocaleString()} 🪙`,
          duration: 5000,
        });
      }, i * 600);
    });
  }, [pendingAchievements, toast]);

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
        if (serverBalance !== null) {
          reconcileServerGems(serverBalance);
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
      toast({
        title: 'Checkout cancelled',
        description: 'No charge was made — your gems are still waiting in the shop.',
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
    if (action === 'battle') setCurrentScreen('game');
    else if (action === 'shop') setShowShop(true);
    else if (action === 'rewards') setShowDailyRewards(true);
    window.history.replaceState({}, '', window.location.pathname);
  }, [session]);

  useEffect(() => {
    const today = new Date().toDateString();
    // Don't auto-open daily rewards over an in-progress purchase verification;
    // stacked dialogs would fight for the keyboard. It opens after the buyer
    // dismisses the payment screen (purchaseSessionId clears → effect re-runs).
    if (session && lastLoginDate !== today && !purchaseSessionId) {
      const timer = setTimeout(() => setShowDailyRewards(true), 500);
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
      <div className="min-h-screen bg-gradient-to-b from-night-800 to-night-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-night-800/60 border border-plush-700/40 rounded-2xl p-8">
          <div className="text-6xl mb-4">🧸🔧</div>
          <h1 className="text-2xl font-bold text-white mb-2">Setup needed</h1>
          <p className="text-white/70">
            The game isn&apos;t connected to its backend yet. Set
            <code className="mx-1 px-1 bg-black/30 rounded">VITE_SUPABASE_URL</code>
            and
            <code className="mx-1 px-1 bg-black/30 rounded">VITE_SUPABASE_ANON_KEY</code>
            in the environment, then reload.
          </p>
          <p className="text-white/40 text-sm mt-3">See <code>.env.example</code> and <code>DEPLOYMENT.md</code>.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-night-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-6xl mb-4"
          >
            🧸
          </motion.div>
          <div className="text-white text-xl">Loading Terrible Teddies...</div>
        </div>
      </div>
    );
  }

  const navigateTo = (screen) => setCurrentScreen(screen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'game':
        return (
          <div className="relative">
            <BackButton onClick={() => navigateTo('menu')} />
            {/* Same Suspense + error-boundary treatment the lazy dialogs get.
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
                  onBackToMenu={() => navigateTo('menu')}
                  onOpenShop={() => { navigateTo('menu'); setShowShop(true); }}
                />
              </Suspense>
            </DialogErrorBoundary>
          </div>
        );
      case 'deck':
        return (
          <div className="min-h-screen bg-gradient-to-b from-night-800 via-night-900 to-night-950 p-4 md:p-8">
            <BackButton onClick={() => navigateTo('menu')} />
            <div className="pt-12">
              <DeckBuilder />
            </div>
          </div>
        );
      case 'collection':
        return (
          <div className="min-h-screen bg-gradient-to-b from-night-800 via-night-900 to-night-950 p-4 md:p-8">
            <BackButton onClick={() => navigateTo('menu')} />
            <div className="pt-12">
              <TeddyCollection />
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
            onShop={() => setShowShop(true)}
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
              <AnimatePresence>
                {showTutorial && (
                  <Tutorial
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

                {showCardPacks && <CardPackOpening onClose={() => setShowCardPacks(false)} />}
                {showPlayerStats && <PlayerStats onClose={() => setShowPlayerStats(false)} />}
                {showSettings && <Settings onClose={() => setShowSettings(false)} />}
                {showDailyRewards && <DailyRewards onClose={() => setShowDailyRewards(false)} />}
                {showShop && <Shop onClose={() => setShowShop(false)} />}
                {showBattlePass && <BattlePass onClose={() => setShowBattlePass(false)} />}
                {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
                {showChallenges && <Challenges onClose={() => setShowChallenges(false)} />}
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
