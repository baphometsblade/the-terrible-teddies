import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from "@/components/ui/progress";
import { getNextEvolution } from '../utils/evolutionPaths';

const Evolution = ({ teddy }) => {
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionProgress, setEvolutionProgress] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const nextEvolution = getNextEvolution(teddy.type, teddy.level);

  const evolveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('evolve_teddy', { teddy_id: teddy.id });
      if (error) throw error;
      return data;
    },
    onMutate: () => {
      setIsEvolving(true);
      const evolutionInterval = setInterval(() => {
        setEvolutionProgress(prev => {
          if (prev >= 100) {
            clearInterval(evolutionInterval);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
    },
    onSuccess: (evolvedTeddy) => {
      queryClient.invalidateQueries('playerTeddies');
      toast({
        title: "Evolution Successful!",
        description: `${teddy.name} has evolved to ${nextEvolution.name}!`,
        variant: "success",
      });
      setIsEvolving(false);
      setEvolutionProgress(0);
    },
    onError: (error) => {
      toast({
        title: "Evolution Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsEvolving(false);
      setEvolutionProgress(0);
    },
  });

  const handleEvolve = () => {
    evolveMutation.mutate();
  };

  return (
    <motion.div 
      className="evolution-container p-4 bg-gray-100 rounded-lg"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-2xl font-bold mb-4">Evolve {teddy.name}</h2>
      <p className="mb-2">Current Level: {teddy.level}</p>
      <p className="mb-4">Current Form: {teddy.name}</p>
      {nextEvolution && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold">Next Evolution:</h3>
          <p>Name: {nextEvolution.name}</p>
          <p>Attack: {nextEvolution.attack}</p>
          <p>Defense: {nextEvolution.defense}</p>
          <p>Special Move: {nextEvolution.special}</p>
        </div>
      )}
      <AnimatePresence>
        {isEvolving && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Progress value={evolutionProgress} className="w-full mb-4" />
          </motion.div>
        )}
      </AnimatePresence>
      <Button 
        onClick={handleEvolve} 
        disabled={isEvolving || teddy.level >= 5}
        className="w-full"
      >
        {isEvolving ? 'Evolving...' : 'Evolve'}
      </Button>
      {teddy.level >= 5 && (
        <p className="mt-2 text-sm text-gray-500">
          This teddy has reached maximum evolution.
        </p>
      )}
    </motion.div>
  );
};

export default Evolution;