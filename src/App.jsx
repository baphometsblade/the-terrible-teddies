import React, { useState } from 'react';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import Auth from './components/Auth';
import GameBoard from './components/GameBoard/GameBoard';
import MainMenu from './components/MainMenu';
import DeckBuilder from './components/DeckBuilder';
import TeddyCollection from './components/TeddyCollection';
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from './components/ErrorBoundary';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { session, loading } = useSupabaseAuth();
  const [currentScreen, setCurrentScreen] = useState('menu');

  if (loading) {
    return (
      <div className="min-h-screen bg-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🧸</div>
          <div className="text-white text-xl">Loading Terrible Teddies...</div>
        </div>
      </div>
    );
  }

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'game':
        return (
          <div className="relative">
            <Button
              className="absolute top-4 left-4 z-50 bg-purple-600 hover:bg-purple-700"
              onClick={() => navigateTo('menu')}
            >
              Back to Menu
            </Button>
            <GameBoard />
          </div>
        );
      case 'deck':
        return (
          <div className="min-h-screen bg-gradient-to-b from-blue-900 to-purple-900 p-8">
            <Button
              className="mb-4 bg-purple-600 hover:bg-purple-700"
              onClick={() => navigateTo('menu')}
            >
              Back to Menu
            </Button>
            <DeckBuilder />
          </div>
        );
      case 'collection':
        return (
          <div className="min-h-screen bg-gradient-to-b from-amber-900 to-orange-900 p-8">
            <Button
              className="mb-4 bg-purple-600 hover:bg-purple-700"
              onClick={() => navigateTo('menu')}
            >
              Back to Menu
            </Button>
            <TeddyCollection />
          </div>
        );
      case 'menu':
      default:
        return (
          <MainMenu
            onStartGame={() => navigateTo('game')}
            onDeckBuilder={() => navigateTo('deck')}
            onCollection={() => navigateTo('collection')}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      <div className="App min-h-screen">
        {session ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        ) : (
          <Auth />
        )}
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}

export default App;
