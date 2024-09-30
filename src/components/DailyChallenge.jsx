import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';

const DailyChallenge = () => {
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const { toast } = useToast();

  const { data: challenge, isLoading, error } = useQuery({
    queryKey: ['dailyChallenge'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*, opponent_teddy:opponent_teddy_id(*)')
        .eq('date', new Date().toISOString().split('T')[0])
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: playerTeddies, isLoading: teddiesLoading } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .eq('player_id', user.id);
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
  });

  const completeDailyChallengeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('complete_daily_challenge', {
        player_teddy_id: selectedTeddy.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Challenge Completed!",
        description: `You earned ${data.reward_coins} coins!`,
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

  if (isLoading || teddiesLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Daily Challenge</h1>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Opponent Teddy</h2>
        <TeddyCard teddy={challenge.opponent_teddy} />
      </div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Select Your Teddy</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {playerTeddies.map(teddy => (
            <div
              key={teddy.id}
              className={`cursor-pointer ${selectedTeddy?.id === teddy.id ? 'border-2 border-blue-500' : ''}`}
              onClick={() => setSelectedTeddy(teddy)}
            >
              <TeddyCard teddy={teddy} />
            </div>
          ))}
        </div>
      </div>
      <Button
        onClick={() => completeDailyChallengeMutation.mutate()}
        disabled={!selectedTeddy || completeDailyChallengeMutation.isLoading}
      >
        Complete Challenge
      </Button>
    </div>
  );
};

export default DailyChallenge;