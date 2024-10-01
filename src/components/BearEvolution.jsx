import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';

const BearEvolution = ({ teddy }) => {
  const [isEvolving, setIsEvolving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const evolveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('evolve_teddy', { teddy_id: teddy.id });
      if (error) throw error;
      return data;
    },
    onSuccess: (evolvedTeddy) => {
      queryClient.invalidateQueries('playerTeddies');
      toast({
        title: "Evolution Successful!",
        description: `${teddy.name} has evolved!`,
        variant: "success",
      });
      setIsEvolving(false);
    },
    onError: (error) => {
      toast({
        title: "Evolution Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsEvolving(false);
    },
  });

  const handleEvolve = () => {
    setIsEvolving(true);
    evolveMutation.mutate();
  };

  return (
    <div className="bear-evolution p-4 bg-gray-100 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Bear Evolution</h2>
      <TeddyCard teddy={teddy} />
      <Button 
        onClick={handleEvolve} 
        disabled={isEvolving || teddy.level >= 10}
        className="mt-4"
      >
        {isEvolving ? 'Evolving...' : 'Evolve Bear'}
      </Button>
      {teddy.level >= 10 && <p className="text-sm text-gray-500 mt-2">This bear has reached maximum evolution.</p>}
    </div>
  );
};

export default BearEvolution;