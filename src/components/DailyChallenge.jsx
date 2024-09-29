import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const DailyChallenge = () => {
  const [isCompleted, setIsCompleted] = useState(false);
  const { toast } = useToast();

  const { data: challenge, isLoading, error } = useQuery({
    queryKey: ['dailyChallenge'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('date', new Date().toISOString().split('T')[0])
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('completed_challenges')
        .insert({ user_id: user.id, challenge_id: challenge.id });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setIsCompleted(true);
      toast({
        title: "Challenge Completed!",
        description: "You've earned your daily reward!",
        variant: "success",
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

  if (isLoading) return <div>Loading daily challenge...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Daily Challenge</h2>
      <p className="mb-4">{challenge.description}</p>
      <p className="mb-4">Reward: {challenge.reward} coins</p>
      <Button 
        onClick={() => completeMutation.mutate()} 
        disabled={isCompleted || completeMutation.isLoading}
      >
        {isCompleted ? "Completed" : "Complete Challenge"}
      </Button>
    </div>
  );
};

export default DailyChallenge;