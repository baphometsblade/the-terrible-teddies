import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '../integrations/supabase';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { GameBoard } from './GameBoard';

export const DailyChallenge = ({ onExit }) => {
  const [challenge, setChallenge] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const { session } = useSupabaseAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchDailyChallenge();
  }, []);

  const fetchDailyChallenge = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('date', new Date().toISOString().split('T')[0])
        .single();

      if (error) throw error;

      if (data) {
        setChallenge(data);
      } else {
        // If no challenge exists for today, create a new one
        const newChallenge = generateChallenge();
        const { data: insertedChallenge, error: insertError } = await supabase
          .from('daily_challenges')
          .insert(newChallenge)
          .single();

        if (insertError) throw insertError;

        setChallenge(insertedChallenge);
      }
    } catch (error) {
      console.error('Error fetching daily challenge:', error);
      toast({
        title: "Error",
        description: "Failed to fetch daily challenge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateChallenge = () => {
    // Generate a random challenge. This is a simple example; you can make it more complex.
    const challenges = [
      { description: "Win a game using only Action cards", reward: 100 },
      { description: "Play 5 Trap cards in a single game", reward: 150 },
      { description: "Heal for a total of 20 HP in one game", reward: 200 },
      { description: "Win a game with 20 or more HP remaining", reward: 250 },
      { description: "Use the Momentum Gauge to its full capacity 3 times", reward: 300 },
    ];
    const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
    return {
      date: new Date().toISOString().split('T')[0],
      ...randomChallenge,
    };
  };

  const startChallenge = () => {
    setIsPlaying(true);
  };

  const handleGameEnd = async (result) => {
    setIsPlaying(false);
    // Here you would check if the player completed the challenge
    // For this example, we'll assume they did if they won
    if (result === 'win') {
      try {
        const { data, error } = await supabase
          .from('user_stats')
          .update({ 
            coins: supabase.sql`coins + ${challenge.reward}`,
            challenges_completed: supabase.sql`challenges_completed + 1`
          })
          .eq('user_id', session.user.id);

        if (error) throw error;

        toast({
          title: "Challenge Completed!",
          description: `You've earned ${challenge.reward} coins!`,
          variant: "success",
        });
      } catch (error) {
        console.error('Error updating user stats:', error);
        toast({
          title: "Error",
          description: "Failed to update rewards. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Challenge Failed",
        description: "Better luck next time!",
        variant: "default",
      });
    }
  };

  if (isLoading) {
    return <div>Loading daily challenge...</div>;
  }

  if (isPlaying) {
    return <GameBoard gameMode="challenge" onExit={handleGameEnd} challengeRules={challenge.description} />;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Daily Challenge</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg mb-4">{challenge.description}</p>
        <p className="text-md mb-6">Reward: {challenge.reward} coins</p>
        <div className="flex justify-between">
          <Button onClick={startChallenge}>Start Challenge</Button>
          <Button onClick={onExit} variant="outline">Back to Menu</Button>
        </div>
      </CardContent>
    </Card>
  );
};
