import React, { useState } from 'react';
import { MainMenu } from '../components/MainMenu';
import { GameBoard } from '../components/GameBoard';
import { AssetGenerator } from '../components/AssetGenerator';
import { LeaderboardComponent } from '../components/LeaderboardComponent';
import { useGeneratedImages } from '../integrations/supabase';

const Index = () => {
  const [gameState, setGameState] = useState('menu');
  const { data: gameData, isLoading, error } = useGeneratedImages();

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
        <div>
          <MainMenu onStartGame={handleStartGame} />
          <div className="mt-8">
            <LeaderboardComponent />
          </div>
        </div>
      ) : (
        <GameBoard onExitGame={handleReturnToMenu} />
      )}
    </div>
  );
};

export default Index;
