import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import Battle from '../Battle/Battle';
import { Button } from "@/components/ui/button";

const GameBoard = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [gameState, setGameState] = useState('selecting'); // 'selecting', 'battling', 'gameOver'

  const { data: playerTeddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*')
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (playerTeddies && playerTeddies.length > 0) {
      setPlayerTeddy(playerTeddies[0]);
      // For now, we'll use a random player teddy as the opponent
      setOpponentTeddy(playerTeddies[Math.floor(Math.random() * playerTeddies.length)]);
    }
  }, [playerTeddies]);

  const startBattle = () => {
    setGameState('battling');
  };

  const handleBattleEnd = (result) => {
    setGameState('gameOver');
    // Handle battle result (e.g., update player stats, show rewards)
  };

  if (isLoading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies</h1>
      {gameState === 'selecting' && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Select Your Teddy</h2>
          {playerTeddies && playerTeddies.map(teddy => (
            <Button key={teddy.id} onClick={() => setPlayerTeddy(teddy)} className="mr-2 mb-2">
              {teddy.name}
            </Button>
          ))}
          <Button onClick={startBattle} disabled={!playerTeddy} className="mt-4">Start Battle</Button>
        </div>
      )}
      {gameState === 'battling' && playerTeddy && opponentTeddy && (
        <Battle
          playerTeddy={playerTeddy}
          opponentTeddy={opponentTeddy}
          onBattleEnd={handleBattleEnd}
        />
      )}
      {gameState === 'gameOver' && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Game Over</h2>
          <Button onClick={() => setGameState('selecting')}>Play Again</Button>
        </div>
      )}
    </div>
  );
};

export default GameBoard;