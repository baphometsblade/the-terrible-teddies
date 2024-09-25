import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from "@/components/ui/button";
import { useGeneratedImages } from '../integrations/supabase';

export const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const { data: teddies, isLoading, error } = useGeneratedImages();

  useEffect(() => {
    if (teddies) {
      const shuffledTeddies = [...teddies].sort(() => Math.random() - 0.5);
      setPlayerHand(shuffledTeddies.slice(0, 5));
      setOpponentHand(shuffledTeddies.slice(5, 10));
    }
  }, [teddies]);

  const handlePlayCard = (card) => {
    // Implement card playing logic here
    console.log('Playing card:', card);
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');
  };

  if (isLoading) return <div>Loading game board...</div>;
  if (error) return <div>Error loading game board: {error.message}</div>;

  return (
    <div className="game-board p-4 bg-gradient-to-br from-purple-800 to-indigo-900 rounded-lg shadow-2xl">
      <div className="opponent-hand mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">Opponent's Hand</h2>
        <div className="flex justify-center space-x-2">
          {opponentHand.map((teddy) => (
            <Card key={teddy.id} teddy={teddy} faceDown />
          ))}
        </div>
      </div>
      <div className="player-hand mt-8">
        <h2 className="text-2xl font-bold text-white mb-4">Your Hand</h2>
        <div className="flex justify-center space-x-2">
          {playerHand.map((teddy) => (
            <Card 
              key={teddy.id} 
              teddy={teddy} 
              onClick={() => handlePlayCard(teddy)}
              disabled={currentTurn !== 'player'}
            />
          ))}
        </div>
      </div>
      <div className="mt-8 text-center">
        <Button 
          onClick={() => setCurrentTurn('opponent')} 
          disabled={currentTurn !== 'player'}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          End Turn
        </Button>
      </div>
    </div>
  );
};
