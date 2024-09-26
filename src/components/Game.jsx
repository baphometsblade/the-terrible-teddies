import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { GameBoard } from './GameBoard/GameBoard';
import { PlayerHand } from './GameBoard/PlayerHand';
import { OpponentArea } from './GameBoard/OpponentArea';
import { Button } from "@/components/ui/button";
import { playSound } from '../utils/audio';

const fetchTeddyBears = async () => {
  const { data, error } = await supabase.from('generated_images').select('*');
  if (error) throw error;
  return data;
};

const Game = () => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');

  const { data: teddyBears, isLoading, error } = useQuery({
    queryKey: ['teddyBears'],
    queryFn: fetchTeddyBears,
  });

  useEffect(() => {
    if (teddyBears) {
      const shuffled = [...teddyBears].sort(() => 0.5 - Math.random());
      setPlayerHand(shuffled.slice(0, 5));
      setOpponentHand(shuffled.slice(5, 10));
    }
  }, [teddyBears]);

  const handlePlayCard = (card) => {
    if (currentTurn !== 'player') return;

    // Apply card effects
    setOpponentHealth(prev => Math.max(0, prev - card.energy_cost));
    setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    playSound('playCard');

    // Check for game over
    if (opponentHealth - card.energy_cost <= 0) {
      alert('You win!');
      return;
    }

    // Switch turns
    setCurrentTurn('opponent');
    setTimeout(handleOpponentTurn, 1000);
  };

  const handleOpponentTurn = () => {
    const card = opponentHand[Math.floor(Math.random() * opponentHand.length)];
    setPlayerHealth(prev => Math.max(0, prev - card.energy_cost));
    setOpponentHand(prev => prev.filter(c => c.id !== card.id));
    playSound('playCard');

    // Check for game over
    if (playerHealth - card.energy_cost <= 0) {
      alert('You lose!');
      return;
    }

    setCurrentTurn('player');
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
      <OpponentArea health={opponentHealth} hand={opponentHand} />
      <GameBoard currentTurn={currentTurn} />
      <PlayerHand hand={playerHand} onPlayCard={handlePlayCard} />
      <div className="mt-4 text-center">
        <Button onClick={() => window.location.reload()}>New Game</Button>
      </div>
    </div>
  );
};

export default Game;