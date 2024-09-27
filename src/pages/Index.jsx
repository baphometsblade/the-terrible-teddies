import React, { useState } from 'react';
import { generateGameAssets } from '../utils/generateGameAssets';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import GameBoard from '../components/GameBoard';
import ErrorBoundary from '../components/ErrorBoundary';

const Index = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState([]);

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setProgress(0);
    try {
      const assets = await generateGameAssets((progress) => {
        setProgress(progress);
      });
      setGeneratedAssets(assets);
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
          <Button onClick={() => setGameStarted(true)} disabled={isGenerating || generatedAssets.length === 0}>
            Start Game
          </Button>
          {generatedAssets.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              {generatedAssets.map((asset, index) => (
                <img key={index} src={asset.url} alt={asset.name} className="w-full h-auto" />
              ))}
            </div>
          )}
        </>
      ) : (
        <ErrorBoundary>
          <GameBoard generatedAssets={generatedAssets} />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Index;