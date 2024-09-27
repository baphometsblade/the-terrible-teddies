import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const GameBoard = () => {
  const [playerBear, setPlayerBear] = useState(null);
  const [opponentBear, setOpponentBear] = useState(null);
  const [gameState, setGameState] = useState('selecting');
  const [turnCount, setTurnCount] = useState(0);

  const { data: bears, isLoading, error } = useQuery({
    queryKey: ['bears'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bears')
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
    attackMutation.mutate({
      attacker_id: playerBear.id,
      defender_id: opponentBear.id,
    });
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
              <p>HP: {playerBear.hp}</p>
              <p>Attack: {playerBear.attack}</p>
              <p>Defense: {playerBear.defense}</p>
              <Button onClick={handleAttack} disabled={attackMutation.isLoading}>
                Attack
              </Button>
            </CardContent>
          </Card>
          <Card className="w-1/2 ml-2">
            <CardHeader>
              <CardTitle>{opponentBear.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>HP: {opponentBear.hp}</p>
              <p>Attack: {opponentBear.attack}</p>
              <p>Defense: {opponentBear.defense}</p>
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