import React, { useState } from 'react';
import { generateGameAssets } from '../utils/generateGameAssets';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import GameBoard from '../components/GameBoard';

const Index = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setProgress(0);
    try {
      await generateGameAssets((progress) => {
        setProgress(progress);
      });
    } catch (error) {
      console.error('Error generating assets:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Terrible Teddies</h1>
      {!gameStarted ? (
        <>
          <Button onClick={handleGenerateAssets} disabled={isGenerating} className="mb-4">
            {isGenerating ? 'Generating...' : 'Generate Assets'}
          </Button>
          {isGenerating && (
            <div className="mb-4">
              <Progress value={progress} className="w-full" />
              <p className="text-center mt-2">{Math.round(progress)}% complete</p>
            </div>
          )}
          <Button onClick={() => setGameStarted(true)} disabled={isGenerating}>
            Start Game
          </Button>
        </>
      ) : (
        <GameBoard />
      )}
    </div>
  );
};

export default Index;