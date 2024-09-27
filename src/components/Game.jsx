import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddySelection from './TeddySelection';
import BattleArena from './BattleArena';
import Leaderboard from './Leaderboard';
import Shop from './Shop';
import { supabase } from '../lib/supabase';

const Game = () => {
  const [gameState, setGameState] = useState('selection');
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);

  useEffect(() => {
    fetchPlayerScore();
  }, []);

  const fetchPlayerScore = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('score')
      .single();
    if (data) setPlayerScore(data.score);
    if (error) console.error('Error fetching player score:', error);
  };

  const handleTeddySelect = (teddy) => {
    setPlayerTeddy(teddy);
    // Randomly select an opponent teddy (this should be improved in the future)
    setOpponentTeddy(teddyData[Math.floor(Math.random() * teddyData.length)]);
    setGameState('battle');
  };

  const handleBattleEnd = (result) => {
    if (result === 'win') {
      setPlayerScore(prevScore => prevScore + 10);
      // Update score in the database
      supabase.from('players').update({ score: playerScore + 10 }).eq('id', 1);
    }
    setGameState('selection');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-purple-600">Cheeky Teddy Brawl</h1>
      {gameState === 'selection' && (
        <TeddySelection onSelect={handleTeddySelect} />
      )}
      {gameState === 'battle' && (
        <BattleArena
          playerTeddy={playerTeddy}
          opponentTeddy={opponentTeddy}
          onBattleEnd={handleBattleEnd}
        />
      )}
      <div className="mt-8 flex justify-between">
        <Leaderboard />
        <Shop />
      </div>
      <p className="mt-4 text-xl font-semibold text-center">Your Score: {playerScore}</p>
    </div>
  );
};

export default Game;