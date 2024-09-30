import React, { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const BearEvolution = ({ teddy, onEvolve }) => {
  const [isEvolving, setIsEvolving] = useState(false);
  const { toast } = useToast();

  const evolutionMutation = useMutation({
    mutationFn: async (teddyId) => {
      const { data, error } = await supabase
        .rpc('evolve_teddy', { teddy_id: teddyId });
      if (error) throw error;
      return data;
    },
    onSuccess: (evolvedTeddy) => {
      onEvolve(evolvedTeddy);
      toast({
        title: "Evolution Complete!",
        description: `${teddy.name} has evolved and become stronger!`,
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Evolution Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsEvolving(false);
    },
  });

  const handleEvolve = () => {
    setIsEvolving(true);
    evolutionMutation.mutate(teddy.id);
  };

  return (
    <div className="bear-evolution">
      <h2 className="text-2xl font-bold mb-4">Bear Evolution</h2>
      <TeddyCard teddy={teddy} />
      <div className="mt-4">
        <p>Evolution Progress</p>
        <Progress value={(teddy.experience / teddy.experience_to_evolve) * 100} className="mt-2" />
        <p>{teddy.experience} / {teddy.experience_to_evolve} XP</p>
      </div>
      <Button 
        onClick={handleEvolve} 
        disabled={isEvolving || teddy.experience < teddy.experience_to_evolve}
        className="mt-4"
      >
        {isEvolving ? 'Evolving...' : 'Evolve Bear'}
      </Button>
    </div>
  );
};

export default BearEvolution;