import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import GameBoard from '../components/GameBoard';
import ErrorBoundary from '../components/ErrorBoundary';
import { generateTeddyBears } from '../utils/teddyGenerator';

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [generatedTeddies, setGeneratedTeddies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartGame = () => {
    console.log('Starting game...');
    setIsLoading(true);
    try {
      const teddies = generateTeddyBears(10); // Generate 10 teddies
      console.log('Teddies generated:', teddies);
      setGeneratedTeddies(teddies);
      setGameStarted(true);
    } catch (error) {
      console.error("Error generating teddies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Terrible Teddies</h1>
      {!gameStarted ? (
        <Button onClick={handleStartGame} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Start Game'}
        </Button>
      ) : (
        <ErrorBoundary>
          {isLoading ? (
            <p>Loading game...</p>
          ) : (
            <GameBoard generatedTeddies={generatedTeddies} />
          )}
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Index;