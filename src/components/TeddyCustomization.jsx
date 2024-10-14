import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';

const TeddyCustomization = ({ teddy }) => {
  const [name, setName] = useState(teddy.name);
  const [color, setColor] = useState(teddy.color || '#8B4513');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const customizeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .update({ name, color })
        .eq('id', teddy.id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('playerTeddies');
      toast({
        title: "Customization Successful!",
        description: `${teddy.name} has been updated!`,
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Customization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCustomize = () => {
    customizeMutation.mutate();
  };

  return (
    <motion.div 
      className="teddy-customization p-4 bg-gray-100 rounded-lg"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-2xl font-bold mb-4">Customize {teddy.name}</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
      </div>
      <Button 
        onClick={handleCustomize} 
        disabled={customizeMutation.isLoading}
        className="w-full"
      >
        {customizeMutation.isLoading ? 'Customizing...' : 'Apply Customization'}
      </Button>
    </motion.div>
  );
};

export default TeddyCustomization;