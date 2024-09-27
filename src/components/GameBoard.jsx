import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import PlayerArea from './PlayerArea';
import { Button } from "@/components/ui/button";

const fetchTeddies = async () => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('*')
    .limit(10);
  if (error) throw error;
  return data;
};

const GameBoard = () => {
  const [playerTeddies, setPlayerTeddies] = useState([]);
  const [opponentTeddies, setOpponentTeddies] = useState([]);
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [gameState, setGameState] = useState('selecting'); // 'selecting', 'battle', 'gameOver'

  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: fetchTeddies,
  });

  useEffect(() => {
    if (teddies) {
      const shuffled = [...teddies].sort(() => 0.5 - Math.random());
      setPlayerTeddies(shuffled.slice(0, 5));
      setOpponentTeddies(shuffled.slice(5, 10));
    }
  }, [teddies]);

  const handleTeddySelect = (teddy) => {
    setSelectedTeddy(teddy);
    setGameState('battle');
  };

  const handleAttack = () => {
    // Implement attack logic here
    console.log('Attack!');
  };

  if (isLoading) return <div className="text-center mt-8">Loading game...</div>;
  if (error) return <div className="text-center mt-8">Error loading game: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4 text-center text-purple-600">Terrible Teddies Battle</h1>
      {gameState === 'selecting' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Select Your Teddy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playerTeddies.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} onSelect={() => handleTeddySelect(teddy)} />
            ))}
          </div>
        </div>
      )}
      {gameState === 'battle' && selectedTeddy && (
        <div className="flex justify-between">
          <PlayerArea teddy={selectedTeddy} isPlayer={true} />
          <div className="flex flex-col items-center justify-center">
            <Button onClick={handleAttack} className="mb-4">Attack</Button>
            <Button onClick={() => setGameState('selecting')}>Back to Selection</Button>
          </div>
          <PlayerArea teddy={opponentTeddies[0]} isPlayer={false} />
        </div>
      )}
    </div>
  );
};

export default GameBoard;