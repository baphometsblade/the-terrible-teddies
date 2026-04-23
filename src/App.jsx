import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import Auth from './components/Auth';
import GameBoard from './components/GameBoard/GameBoard';
import MainMenu from './components/MainMenu';
import DeckBuilder from './components/DeckBuilder';
import TeddyCollection from './components/TeddyCollection';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import ErrorBoundary from './components/ErrorBoundary';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from './stores/gameStore';

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
  const [purchaseSessionId, setPurchaseSessionId] = useState(null);

  const { tutorialCompleted, setTutorialCompleted, lastLoginDate, pendingAchievements, shiftPendingAchievement } = useGameStore();
  const { toast } = useToast();

  // Show achievement unlock toasts whenever new achievements are queued
  useEffect(() => {
    if (!pendingAchievements || pendingAchievements.length === 0) return;
    const achievement = shiftPendingAchievement();
    if (!achievement) return;
    toast({
      title: `${achievement.icon} Achievement Unlocked!`,
      description: `${achievement.name} — +${achievement.reward.toLocaleString()} 🪙`,
      duration: 5000,
    });
  }, [pendingAchievements?.length]);

  // Detect Stripe Checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');
    const sessionId = params.get('session_id');
    if (purchase === 'success' && sessionId) {
      setPurchaseSessionId(sessionId);
      // Clean URL without triggering a reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const today = new Date().toDateString();
    if (session && lastLoginDate !== today) {
      const timer = setTimeout(() => setShowDailyRewards(true), 500);
      return () => clearTimeout(timer);
    }
  }, [session, lastLoginDate]);

  useEffect(() => {
    if (session && !tutorialCompleted && !showDailyRewards) {
      const timer = setTimeout(() => setShowTutorial(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [session, tutorialCompleted, showDailyRewards]);

  if (loading) {
    return (
      <div className="min-h-screen bg-purple-900 flex items-center justify-center">
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

  const BackButton = () => (
    <Button
      className="absolute top-4 left-4 z-40 bg-purple-600 hover:bg-purple-700"
      onClick={() => navigateTo('menu')}
    >
      ← Menu
    </Button>
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case 'game':
        return (
          <div className="relative">
            <BackButton />
            <GameBoard />
          </div>
        );
      case 'deck':
        return (
          <div className="min-h-screen bg-gradient-to-b from-blue-900 to-purple-900 p-4 md:p-8">
            <BackButton />
            <div className="pt-12">
              <DeckBuilder />
            </div>
          </div>
        );
      case 'collection':
        return (
          <div className="min-h-screen bg-gradient-to-b from-amber-900 to-orange-900 p-4 md:p-8">
            <BackButton />
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

                {purchaseSessionId && (
                  <PurchaseSuccess
                    sessionId={purchaseSessionId}
                    onDone={() => setPurchaseSessionId(null)}
                  />
                )}
              </AnimatePresence>
            </Suspense>
          </>
        ) : (
          <Auth />
        )}
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}

export default App;
