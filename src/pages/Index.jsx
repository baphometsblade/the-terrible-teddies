import React, { useState, useEffect } from 'react';
import { MainMenu } from '../components/MainMenu';
import { GameBoard } from '../components/GameBoard';
import { AssetGenerator } from '../components/AssetGenerator';
import { useGeneratedImages } from '../integrations/supabase';
import { setupTerribleTeddies } from '../utils/supabaseSetup';

const Index = () => {
  const [gameState, setGameState] = useState('menu');
  const { data: gameData, isLoading, error } = useGeneratedImages();

  useEffect(() => {
    setupTerribleTeddies();
  }, []);

  const handleStartGame = () => setGameState('playing');
  const handleReturnToMenu = () => setGameState('menu');

  if (isLoading) {
    return <div>Loading game data...</div>;
  }

  if (error) {
    return <div>Error loading game data: {error.message}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white p-8">
      {!gameData || gameData.length === 0 ? (
        <AssetGenerator onComplete={() => setGameState('menu')} />
      ) : gameState === 'menu' ? (
        <MainMenu onStartGame={handleStartGame} />
      ) : (
        <GameBoard onExitGame={handleReturnToMenu} />
      )}
    </div>
  );
};

export default Index;
