import React from 'react';
import { useGameState } from '../hooks/useGameState';
import GameMenu from './GameMenu';
import GameContent from './GameContent';
import TeddyList from './TeddyList';
import { Button } from "@/components/ui/button";
import ErrorBoundary from './ErrorBoundary';

const TerribleTeddiesGame = () => {
  const {
    gameState,
    setGameState,
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

  if (error) {
    console.error('TerribleTeddiesGame: Error state', error);
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">Error: {error.message}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (isLoading) {
    console.log('TerribleTeddiesGame: Loading state');
    return <div className="text-center py-8">Loading your teddies...</div>;
  }

  console.log('TerribleTeddiesGame: Rendering main content');
  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
        <TeddyList />
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
        <GameMenu
          startBattle={startBattle}
          selectedTeddy={selectedTeddy}
          setGameState={setGameState}
        />
      </div>
    </ErrorBoundary>
  );
};

export default TerribleTeddiesGame;