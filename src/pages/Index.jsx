import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { GameBoard } from '../components/GameBoard/GameBoard';
import { AssetGenerator } from '../components/AssetGenerator';

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [assetsGenerated, setAssetsGenerated] = useState(false);

  return (
    <div className="container mx-auto p-4 bg-gray-900 min-h-screen text-white">
      <h1 className="text-4xl font-bold text-center mb-8">Terrible Teddies</h1>
      {!assetsGenerated ? (
        <AssetGenerator onComplete={() => setAssetsGenerated(true)} />
      ) : !gameStarted ? (
        <div className="text-center">
          <p className="mb-4 text-xl">Welcome to the ultimate ultra-realistic teddy bear brawler!</p>
          <Button onClick={() => setGameStarted(true)} className="bg-red-600 hover:bg-red-700">
            Start Game
          </Button>
        </div>
      ) : (
        <GameBoard onExit={() => setGameStarted(false)} />
      )}
    </div>
  );
};

export default Index;
