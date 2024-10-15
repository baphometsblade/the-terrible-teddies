import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const TerribleTeddiesGame = () => {
  const { toast } = useToast();
  const [gameState, setGameState] = useState('menu');

  const { data: playerTeddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(pt => pt.terrible_teddies);
    },
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading teddies",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (isLoading) return <div>Loading your teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Welcome to Terrible Teddies</h2>
      {playerTeddies && playerTeddies.length > 0 ? (
        <div>
          <p>You have {playerTeddies.length} teddies!</p>
          <ul>
            {playerTeddies.map(teddy => (
              <li key={teddy.id}>{teddy.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>You don't have any teddies yet. Start collecting!</p>
      )}
      <Button onClick={() => setGameState('battle')} className="mt-4">Start Battle</Button>
    </div>
  );
};

export default TerribleTeddiesGame;