import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';

const Evolution = ({ teddy }) => {
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
    <motion.div 
      className="evolution-container p-4 bg-gray-100 rounded-lg"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-2xl font-bold mb-4">Evolve {teddy.name}</h2>
      <p className="mb-4">Current Level: {teddy.level}</p>
      <Button 
        onClick={handleEvolve} 
        disabled={isEvolving || teddy.level >= 3}
        className="w-full"
      >
        {isEvolving ? 'Evolving...' : 'Evolve'}
      </Button>
      {teddy.level >= 3 && (
        <p className="mt-2 text-sm text-gray-500">
          This teddy has reached maximum evolution.
        </p>
      )}
    </motion.div>
  );
};

export default Evolution;