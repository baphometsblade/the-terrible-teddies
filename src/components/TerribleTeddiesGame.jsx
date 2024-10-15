import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from './ErrorBoundary';
import GameMenu from './GameMenu';
import GameContent from './GameContent';
import { useGameState } from '../hooks/useGameState';

const TerribleTeddiesGame = () => {
  const {
    gameState,
    selectedTeddy,
    setSelectedTeddy,
    powerUps,
    setPowerUps,
    achievements,
    setAchievements,
    playerTeddies,
    isLoading,
    error,
    startBattle,
    handleBattleEnd
  } = useGameState();

  if (isLoading) return <div>Loading your teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
        <AnimatePresence mode="wait">
          <motion.div
            key={gameState}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <GameContent
              gameState={gameState}
              playerTeddies={playerTeddies}
              selectedTeddy={selectedTeddy}
              setSelectedTeddy={setSelectedTeddy}
              onBattleEnd={handleBattleEnd}
              powerUps={powerUps}
              setPowerUps={setPowerUps}
              achievements={achievements}
              setAchievements={setAchievements}
            />
          </motion.div>
        </AnimatePresence>
        <GameMenu
          startBattle={startBattle}
          selectedTeddy={selectedTeddy}
        />
      </div>
    </ErrorBoundary>
  );
};

export default TerribleTeddiesGame;