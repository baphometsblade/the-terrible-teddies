import React, { useEffect, useState } from 'react';
import { useGameState } from '../hooks/useGameState';
import GameMenu from './GameMenu';
import GameContent from './GameContent';
import { Button } from "@/components/ui/button";
import ErrorBoundary from './ErrorBoundary';

const TerribleTeddiesGame = () => {
  const [error, setError] = useState(null);
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
    error: gameStateError,
    startBattle,
    handleBattleEnd
  } = useGameState();

  useEffect(() => {
    console.log('TerribleTeddiesGame rendered', { 
      gameState, 
      selectedTeddy: selectedTeddy ? selectedTeddy.id : 'none', 
      playerTeddies: playerTeddies ? playerTeddies.length : 'undefined', 
      isLoading, 
      error: gameStateError ? gameStateError.message : 'none'
    });

    if (gameStateError) {
      setError(gameStateError);
    }
  }, [gameState, selectedTeddy, playerTeddies, isLoading, gameStateError]);

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
  
  if (!playerTeddies || playerTeddies.length === 0) {
    console.log('TerribleTeddiesGame: No teddies found');
    return (
      <div className="text-center py-8">
        <p className="mb-4">No teddies found. Let's get you started!</p>
        <Button onClick={() => setGameState('shop')}>Visit Shop</Button>
      </div>
    );
  }

  console.log('TerribleTeddiesGame: Rendering main content');
  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
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