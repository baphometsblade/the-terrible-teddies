import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import PlayerArea from './PlayerArea';
import { Button } from "@/components/ui/button";
import { calculateDamage } from '../utils/gameLogic';

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
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [gameState, setGameState] = useState('selecting'); // 'selecting', 'battle', 'gameOver'
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');

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
    setOpponentTeddy(opponentTeddies[Math.floor(Math.random() * opponentTeddies.length)]);
    setGameState('battle');
  };

  const handleAttack = () => {
    if (currentTurn === 'player') {
      const damage = calculateDamage(selectedTeddy, opponentTeddy);
      setOpponentHP(prevHP => Math.max(0, prevHP - damage));
      setCurrentTurn('opponent');
    } else {
      const damage = calculateDamage(opponentTeddy, selectedTeddy);
      setPlayerHP(prevHP => Math.max(0, prevHP - damage));
      setCurrentTurn('player');
    }

    if (playerHP <= 0 || opponentHP <= 0) {
      setGameState('gameOver');
    }
  };

  const resetGame = () => {
    setSelectedTeddy(null);
    setOpponentTeddy(null);
    setGameState('selecting');
    setPlayerHP(30);
    setOpponentHP(30);
    setCurrentTurn('player');
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
      {gameState === 'battle' && selectedTeddy && opponentTeddy && (
        <div className="flex flex-col md:flex-row justify-between">
          <PlayerArea teddy={selectedTeddy} isPlayer={true} hp={playerHP} />
          <div className="flex flex-col items-center justify-center my-4 md:my-0">
            <p className="text-xl font-bold mb-2">{currentTurn === 'player' ? "Your Turn" : "Opponent's Turn"}</p>
            <Button onClick={handleAttack} className="mb-4">Attack</Button>
          </div>
          <PlayerArea teddy={opponentTeddy} isPlayer={false} hp={opponentHP} />
        </div>
      )}
      {gameState === 'gameOver' && (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">{playerHP > 0 ? "You Win!" : "You Lose!"}</h2>
          <Button onClick={resetGame}>Play Again</Button>
        </div>
      )}
    </div>
  );
};

export default GameBoard;