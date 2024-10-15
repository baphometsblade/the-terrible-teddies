import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

const Evolution = ({ teddy, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const evolutionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('evolve_teddy', { teddy_id: teddy.id });
      if (error) throw error;
      return data;
    },
    onSuccess: (evolvedTeddy) => {
      queryClient.invalidateQueries('playerTeddies');
      toast({
        title: "Evolution Successful!",
        description: `${teddy.name} has evolved to ${evolvedTeddy.name}!`,
        variant: "success",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Evolution Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEvolve = () => {
    evolutionMutation.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Evolve {teddy.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Current Level: {teddy.level}</p>
          <p>Experience: {teddy.experience} / {teddy.level * 100}</p>
          <p className="mt-4">Evolving will increase your teddy's stats and potentially unlock new abilities!</p>
          <Button 
            onClick={handleEvolve} 
            className="mt-4 w-full"
            disabled={teddy.experience < teddy.level * 100 || evolutionMutation.isLoading}
          >
            {evolutionMutation.isLoading ? 'Evolving...' : 'Evolve'}
          </Button>
          <Button onClick={onClose} variant="outline" className="mt-2 w-full">
            Cancel
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default Evolution;