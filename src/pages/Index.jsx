import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import GameBoard from '../components/GameBoard';
import ErrorBoundary from '../components/ErrorBoundary';
import { generateTeddyBears } from '../utils/teddyGenerator';

const Index = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [generatedTeddies, setGeneratedTeddies] = useState([]);

  const handleGenerateTeddies = async () => {
    setIsGenerating(true);
    setProgress(0);
    
    const totalTeddies = 50;
    const generatedTeddies = [];
    
    for (let i = 0; i < totalTeddies; i++) {
      const newTeddy = generateTeddyBears(1)[0];
      generatedTeddies.push(newTeddy);
      setProgress(((i + 1) / totalTeddies) * 100);
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate generation time
    }
    
    setGeneratedTeddies(generatedTeddies);
    setIsGenerating(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Terrible Teddies</h1>
      {!gameStarted ? (
        <>
          <Button onClick={handleGenerateTeddies} disabled={isGenerating} className="mb-4">
            {isGenerating ? 'Generating...' : 'Generate Terrible Teddies'}
          </Button>
          {isGenerating && (
            <div className="mb-4">
              <Progress value={progress} className="w-full" />
              <p className="text-center mt-2">{Math.round(progress)}% complete</p>
            </div>
          )}
          <Button onClick={() => setGameStarted(true)} disabled={isGenerating || generatedTeddies.length === 0}>
            Start Game
          </Button>
          {generatedTeddies.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              {generatedTeddies.map((teddy) => (
                <div key={teddy.id} className="border p-4 rounded">
                  <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-auto mb-2" />
                  <h3 className="font-bold">{teddy.name}</h3>
                  <p>{teddy.title}</p>
                  <p>Attack: {teddy.attack}</p>
                  <p>Defense: {teddy.defense}</p>
                  <p>Special Move: {teddy.specialMove}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <ErrorBoundary>
          <GameBoard generatedTeddies={generatedTeddies} />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Index;