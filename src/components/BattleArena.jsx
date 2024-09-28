import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { calculateDamage } from '../utils/gameLogic';

const fetchTeddies = async () => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('*')
    .limit(10);
  if (error) throw error;
  return data;
};

const BattleArena = () => {
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['battle-teddies'],
    queryFn: fetchTeddies,
  });

  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [battleLog, setBattleLog] = useState([]);

  const selectTeddy = (teddy) => {
    if (!playerTeddy) {
      setPlayerTeddy(teddy);
    } else if (!opponentTeddy) {
      setOpponentTeddy(teddy);
    }
  };

  const startBattle = () => {
    if (playerTeddy && opponentTeddy) {
      const newLog = [`${playerTeddy.name} vs ${opponentTeddy.name}`];
      // Simplified battle logic
      const playerDamage = Math.max(0, playerTeddy.attack - opponentTeddy.defense);
      const opponentDamage = Math.max(0, opponentTeddy.attack - playerTeddy.defense);
      newLog.push(`${playerTeddy.name} deals ${playerDamage} damage!`);
      newLog.push(`${opponentTeddy.name} deals ${opponentDamage} damage!`);
      if (playerDamage > opponentDamage) {
        newLog.push(`${playerTeddy.name} wins!`);
      } else if (opponentDamage > playerDamage) {
        newLog.push(`${opponentTeddy.name} wins!`);
      } else {
        newLog.push("It's a tie!");
      }
      setBattleLog(newLog);
    }
  };

  if (isLoading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-center mt-8">Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-4 text-center">Battle Arena</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-xl font-bold mb-2">Your Teddy</h3>
          {playerTeddy ? (
            <TeddyCard teddy={playerTeddy} />
          ) : (
            <p>Select your teddy</p>
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Opponent Teddy</h3>
          {opponentTeddy ? (
            <TeddyCard teddy={opponentTeddy} />
          ) : (
            <p>Select opponent teddy</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        {teddies && teddies.map(teddy => (
          <Button key={teddy.id} onClick={() => selectTeddy(teddy)} className="w-full">
            {teddy.name}
          </Button>
        ))}
      </div>
      <Button onClick={startBattle} disabled={!playerTeddy || !opponentTeddy} className="w-full mb-4">
        Start Battle
      </Button>
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="text-xl font-bold mb-2">Battle Log</h3>
        {battleLog.map((log, index) => (
          <p key={index}>{log}</p>
        ))}
      </div>
    </div>
  );
};

export default BattleArena;