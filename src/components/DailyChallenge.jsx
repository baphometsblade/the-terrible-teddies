import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  const [completed, setCompleted] = useState(false);
  const { toast } = useToast();

  const { data: challenge, isLoading, error } = useQuery({
    queryKey: ['dailyChallenge'],
    queryFn: fetchDailyChallenge,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Implement challenge completion logic here
      // For now, we'll just show a success message
      setCompleted(true);
      toast({
        title: "Challenge Completed!",
        description: `You've earned ${challenge.reward} coins!`,
        variant: "success",
      });
    },
  });

  if (isLoading) return <div className="text-center mt-8">Loading daily challenge...</div>;
  if (error) return <div className="text-center mt-8">Error loading daily challenge: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4 text-center text-purple-600">Daily Challenge</h1>
      {challenge && (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>{challenge.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{challenge.description}</p>
            <p className="mb-4">Reward: {challenge.reward} coins</p>
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={completed}
            >
              {completed ? "Completed" : "Complete Challenge"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyChallenge;