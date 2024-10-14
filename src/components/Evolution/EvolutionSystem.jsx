import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from 'framer-motion';
import TeddyCard from '../TeddyCard';

const EvolutionSystem = ({ teddyId }) => {
  const queryClient = useQueryClient();

  const { data: teddy, isLoading } = useQuery({
    queryKey: ['teddy', teddyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', teddyId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const evolveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .update({
          level: teddy.level + 1,
          attack: teddy.attack + 2,
          defense: teddy.defense + 2,
          xp: 0,
        })
        .eq('id', teddyId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['teddy', teddyId]);
    },
  });

  const handleEvolve = () => {
    if (teddy.xp >= 100) {
      evolveMutation.mutate();
    }
  };

  if (isLoading) {
    return <div>Loading teddy data...</div>;
  }

  return (
    <Card className="evolution-system p-4 bg-gray-100 rounded-lg shadow-lg">
      <CardHeader>
        <CardTitle>Evolution System</CardTitle>
      </CardHeader>
      <CardContent>
        <TeddyCard teddy={teddy} />
        <div className="mt-4">
          <p>Level: {teddy.level}</p>
          <p>XP: {teddy.xp}/100</p>
          <Progress value={(teddy.xp / 100) * 100} className="mt-2" />
        </div>
        <Button
          onClick={handleEvolve}
          disabled={teddy.xp < 100}
          className="mt-4"
        >
          Evolve
        </Button>
        {evolveMutation.isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-2 bg-green-100 text-green-800 rounded"
          >
            Evolution successful! Your teddy is now level {teddy.level + 1}!
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default EvolutionSystem;