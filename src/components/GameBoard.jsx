import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyBear from './TeddyBear';

const GameBoard = () => {
  const [playerBear, setPlayerBear] = useState(null);
  const [opponentBear, setOpponentBear] = useState(null);
  const [gameState, setGameState] = useState('selecting');
  const [turnCount, setTurnCount] = useState(0);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);

  const { data: bears, isLoading, error } = useQuery({
    queryKey: ['bears'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const attackMutation = useMutation({
    mutationFn: async (attackData) => {
      const { data, error } = await supabase
        .rpc('perform_attack', attackData);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPlayerBear(data.player_bear);
      setOpponentBear(data.opponent_bear);
      setTurnCount(turnCount + 1);
      if (data.game_over) {
        setGameState('gameOver');
      } else {
        switchTurns();
      }
    },
  });

  useEffect(() => {
    if (bears && bears.length >= 2) {
      setPlayerBear(bears[0]);
      setOpponentBear(bears[1]);
      setGameState('battle');
    }
  }, [bears]);

  const handleAttack = () => {
    if (playerEnergy >= 1) {
      attackMutation.mutate({
        attacker_id: playerBear.id,
        defender_id: opponentBear.id,
      });
      setPlayerEnergy(playerEnergy - 1);
    }
  };

  const handleSpecialMove = () => {
    if (playerEnergy >= 2) {
      // Implement special move logic here
      setPlayerEnergy(playerEnergy - 2);
      switchTurns();
    }
  };

  const switchTurns = () => {
    setTurnCount(turnCount + 1);
    if (turnCount % 2 === 0) {
      setPlayerEnergy(Math.min(playerEnergy + 1, 3));
    } else {
      setOpponentEnergy(Math.min(opponentEnergy + 1, 3));
      // Implement AI opponent turn logic here
    }
  };

  if (isLoading) return <div>Loading game...</div>;
  if (error) return <div>Error loading game: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies Battle</h1>
      {gameState === 'battle' && playerBear && opponentBear && (
        <div className="flex justify-between">
          <Card className="w-1/2 mr-2">
            <CardHeader>
              <CardTitle>{playerBear.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <TeddyBear bear={playerBear} />
              <p>Energy: {playerEnergy}/3</p>
              <Button onClick={handleAttack} disabled={attackMutation.isLoading || playerEnergy < 1}>
                Attack
              </Button>
              <Button onClick={handleSpecialMove} disabled={playerEnergy < 2}>
                Special Move
              </Button>
            </CardContent>
          </Card>
          <Card className="w-1/2 ml-2">
            <CardHeader>
              <CardTitle>{opponentBear.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <TeddyBear bear={opponentBear} />
              <p>Energy: {opponentEnergy}/3</p>
            </CardContent>
          </Card>
        </div>
      )}
      {gameState === 'gameOver' && (
        <div className="text-center mt-4">
          <h2 className="text-2xl font-bold">Game Over!</h2>
          <p>{playerBear.hp > 0 ? 'You win!' : 'You lose!'}</p>
        </div>
      )}
    </div>
  );
};

export default GameBoard;