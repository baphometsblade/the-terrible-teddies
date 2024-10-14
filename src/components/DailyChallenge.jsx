import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';

const DailyChallenge = () => {
  const [isCompleting, setIsCompleting] = useState(false);
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
      const { data, error } = await supabase.rpc('complete_daily_challenge');
      if (error) throw error;
      return data;
    },
    onSuccess: (reward) => {
      toast({
        title: "Challenge Completed!",
        description: `You earned ${reward} coins!`,
        variant: "success",
      });
      setIsCompleting(false);
    },
    onError: (error) => {
      toast({
        title: "Challenge Completion Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsCompleting(false);
    },
  });

  const handleComplete = () => {
    setIsCompleting(true);
    completeMutation.mutate();
  };

  if (isLoading) return <div>Loading daily challenge...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <motion.div 
      className="daily-challenge p-4 bg-gray-100 rounded-lg"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Daily Challenge</h2>
      <p className="mb-4">{challenge.description}</p>
      <p className="mb-4">Reward: {challenge.reward} coins</p>
      <Button 
        onClick={handleComplete} 
        disabled={isCompleting}
        className="w-full"
      >
        {isCompleting ? 'Completing...' : 'Complete Challenge'}
      </Button>
    </motion.div>
  );
};

export default DailyChallenge;