import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const fetchDailyChallenge = async () => {
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  return data;
};

const DailyChallenge = () => {
  const { data: challenge, isLoading, error } = useQuery({
    queryKey: ['dailyChallenge'],
    queryFn: fetchDailyChallenge,
  });

  const [completed, setCompleted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkCompletion = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && challenge) {
        const { data, error } = await supabase
          .from('challenge_completions')
          .select('*')
          .eq('user_id', user.id)
          .eq('challenge_id', challenge.id)
          .single();

        if (data) setCompleted(true);
      }
    };

    checkCompletion();
  }, [challenge]);

  const handleComplete = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && challenge) {
      const { error } = await supabase
        .from('challenge_completions')
        .insert({ user_id: user.id, challenge_id: challenge.id });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to complete the challenge. Please try again.",
          variant: "destructive",
        });
      } else {
        setCompleted(true);
        toast({
          title: "Challenge Completed!",
          description: `You've earned ${challenge.reward_coins} coins!`,
          variant: "success",
        });
      }
    }
  };

  if (isLoading) return <div>Loading daily challenge...</div>;
  if (error) return <div>Error loading daily challenge: {error.message}</div>;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Daily Challenge</CardTitle>
      </CardHeader>
      <CardContent>
        {challenge ? (
          <>
            <p className="mb-4">{challenge.description}</p>
            <p className="mb-4">Reward: {challenge.reward_coins} coins</p>
            <Button
              onClick={handleComplete}
              disabled={completed}
            >
              {completed ? "Completed" : "Complete Challenge"}
            </Button>
          </>
        ) : (
          <p>No daily challenge available.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyChallenge;