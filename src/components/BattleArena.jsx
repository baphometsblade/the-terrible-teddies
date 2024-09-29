import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const BattleArena = () => {
  const [battleId, setBattleId] = useState(null);
  const { toast } = useToast();

  const { data: battle, isLoading, error, refetch } = useQuery({
    queryKey: ['battle', battleId],
    queryFn: async () => {
      if (!battleId) return null;
      const { data, error } = await supabase
        .from('battles')
        .select('*, player1:player1_id(*), player2:player2_id(*), player1_teddy:player1_teddy_id(*), player2_teddy:player2_teddy_id(*)')
        .eq('id', battleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!battleId,
  });

  const battleActionMutation = useMutation({
    mutationFn: async ({ action }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/battle-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          battleId,
          action,
          playerId: user.id,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const createBattle = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerTeddy } = await supabase
        .from('player_teddies')
        .select('teddy_id')
        .eq('player_id', user.id)
        .limit(1)
        .single();

      if (!playerTeddy) return;

      const { data: battle, error } = await supabase
        .from('battles')
        .insert({
          player1_id: user.id,
          player2_id: user.id, // For simplicity, player is battling themselves
          player1_teddy_id: playerTeddy.teddy_id,
          player2_teddy_id: playerTeddy.teddy_id,
          current_turn: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating battle:', error);
        return;
      }

      setBattleId(battle.id);
    };

    createBattle();
  }, []);

  if (isLoading) return <div>Loading battle...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!battle) return <div>No active battle</div>;

  const isPlayer1Turn = battle.current_turn === battle.player1_id;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Battle Arena</h1>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold mb-2">Player 1</h2>
          {battle.player1_teddy && <TeddyCard teddy={battle.player1_teddy} />}
          <p>Health: {battle.player1_health}/30</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Player 2</h2>
          {battle.player2_teddy && <TeddyCard teddy={battle.player2_teddy} />}
          <p>Health: {battle.player2_health}/30</p>
        </div>
      </div>
      <div className="mb-4">
        <Button 
          onClick={() => battleActionMutation.mutate({ action: 'attack' })}
          disabled={battleActionMutation.isLoading || battle.status === 'finished'}
        >
          Attack
        </Button>
      </div>
      <div>
        <h3 className="text-lg font-bold mb-2">Battle Status</h3>
        <p>Current Turn: {isPlayer1Turn ? 'Player 1' : 'Player 2'}</p>
        <p>Status: {battle.status}</p>
      </div>
    </div>
  );
};

export default BattleArena;