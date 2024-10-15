import React from 'react';
import { useGameState } from '../hooks/useGameState';
import GameMenu from './GameMenu';
import GameContent from './GameContent';

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
      />
    </div>
  );
};

export default TerribleTeddiesGame;