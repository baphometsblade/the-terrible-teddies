import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from '../TeddyCard';

const TeddyLab = () => {
  const [selectedTeddies, setSelectedTeddies] = useState([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fuseTeddiesMutation = useMutation({
    mutationFn: async (teddyIds) => {
      const { data, error } = await supabase.rpc('fuse_teddies', { teddy_ids: teddyIds });
      if (error) throw error;
      return data;
    },
    onSuccess: (newTeddy) => {
      queryClient.invalidateQueries('playerTeddies');
      toast({
        title: "Fusion Successful!",
        description: `You created a new teddy: ${newTeddy.name}!`,
        variant: "success",
      });
      setSelectedTeddies([]);
    },
    onError: (error) => {
      toast({
        title: "Fusion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTeddySelect = (teddy) => {
    if (selectedTeddies.find(t => t.id === teddy.id)) {
      setSelectedTeddies(selectedTeddies.filter(t => t.id !== teddy.id));
    } else if (selectedTeddies.length < 2) {
      setSelectedTeddies([...selectedTeddies, teddy]);
    }
  };

  const handleFusion = () => {
    if (selectedTeddies.length === 2) {
      fuseTeddiesMutation.mutate(selectedTeddies.map(t => t.id));
    }
  };

  return (
    <motion.div
      className="teddy-lab bg-gray-100 p-4 rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Teddy Lab</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {selectedTeddies.map((teddy, index) => (
          <TeddyCard key={index} teddy={teddy} onClick={() => handleTeddySelect(teddy)} />
        ))}
      </div>
      <Button
        onClick={handleFusion}
        disabled={selectedTeddies.length !== 2 || fuseTeddiesMutation.isLoading}
        className="w-full mb-4"
      >
        {fuseTeddiesMutation.isLoading ? 'Fusing...' : 'Fuse Teddies'}
      </Button>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Render player's teddies here for selection */}
      </div>
    </motion.div>
  );
};

export default TeddyLab;