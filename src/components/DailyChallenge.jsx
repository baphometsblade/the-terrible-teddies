import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';

const DailyChallenge = () => {
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const { toast } = useToast();

  const { data: challenge, isLoading, error } = useQuery({
    queryKey: ['dailyChallenge'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_daily_challenge');
      if (error) throw error;
      return data;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('complete_daily_challenge', { player_teddy_id: playerTeddy.id });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Challenge Completed!",
        description: `You've earned ${data.reward_coins} coins!`,
      });
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
    const fetchPlayerTeddies = async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*')
        .limit(1)
        .single();
      if (error) {
        console.error('Error fetching player teddies:', error);
      } else {
        setPlayerTeddy(data);
      }
    };
    fetchPlayerTeddies();
  }, []);

  if (isLoading) return <div>Loading daily challenge...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Daily Challenge</h1>
      {challenge && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-4">
          <h2 className="text-2xl font-bold mb-2">{challenge.title}</h2>
          <p className="mb-4">{challenge.description}</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="text-xl font-bold mb-2">Your Teddy</h3>
              {playerTeddy && <TeddyCard teddy={playerTeddy} />}
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Opponent Teddy</h3>
              <TeddyCard teddy={challenge.opponent_teddy} />
            </div>
          </div>
          <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isLoading}>
            {completeMutation.isLoading ? 'Completing...' : 'Complete Challenge'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DailyChallenge;