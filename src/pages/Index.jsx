import React, { useState } from 'react';
import { Header } from '../components/Header';
import { MainMenu } from '../components/MainMenu';
import { GameBoard } from '../components/GameBoard';
import { AssetGenerator } from '../components/AssetGenerator';

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [assetsGenerated, setAssetsGenerated] = useState(false);

  const handleAssetGenerationComplete = () => {
    setAssetsGenerated(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {!assetsGenerated ? (
          <AssetGenerator onComplete={handleAssetGenerationComplete} />
        ) : gameStarted ? (
          <GameBoard onExit={() => setGameStarted(false)} />
        ) : (
          <MainMenu onStartGame={() => setGameStarted(true)} />
        )}
      </main>
    </div>
  );
};

export default Index;
