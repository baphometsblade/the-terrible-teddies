import React from 'react';
import { useGameState } from '../hooks/useGameState';
import GameMenu from './GameMenu';
import GameContent from './GameContent';
import { Button } from "@/components/ui/button";

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

  if (isLoading) return <div className="text-center py-8">Loading your teddies...</div>;
  
  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">Error: {error.message}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!playerTeddies || playerTeddies.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="mb-4">No teddies found. Let's get you started!</p>
        <Button onClick={() => setGameState('shop')}>Visit Shop</Button>
      </div>
    );
  }

  return (
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
  );
};

export default TerribleTeddiesGame;