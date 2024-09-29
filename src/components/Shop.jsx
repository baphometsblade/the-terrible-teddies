import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';

const Shop = () => {
  const { toast } = useToast();

  const { data: shopItems, isLoading, error } = useQuery({
    queryKey: ['shopItems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
      if (error) throw error;
      return data;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (itemId) => {
      // Here you would implement the logic to purchase an item
      // This is a placeholder implementation
      const { data, error } = await supabase
        .from('player_items')
        .insert({ user_id: (await supabase.auth.getUser()).data.user.id, item_id: itemId })
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Purchase Successful",
        description: "You've successfully purchased the item!",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Purchase Failed",
        description: `Failed to purchase item: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <div>Loading shop items...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies Shop</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopItems.map((item) => (
          <motion.div
            key={item.id}
            className="bg-white p-4 rounded shadow"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-xl font-bold mb-2">{item.name}</h2>
            <p className="mb-2">{item.description}</p>
            <p className="mb-2 font-bold">Price: {item.price} coins</p>
            <Button onClick={() => purchaseMutation.mutate(item.id)} disabled={purchaseMutation.isLoading}>
              {purchaseMutation.isLoading ? 'Purchasing...' : 'Purchase'}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Shop;