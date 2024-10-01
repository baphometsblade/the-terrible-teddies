import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';

const Shop = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: shopItems, isLoading, error } = useQuery({
    queryKey: ['shopItems'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shop_items').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: playerCoins } = useQuery({
    queryKey: ['playerCoins'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('players')
        .select('coins')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data.coins;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (itemId) => {
      const { data, error } = await supabase.rpc('purchase_shop_item', { item_id: itemId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('playerCoins');
      queryClient.invalidateQueries('playerTeddies');
      toast({
        title: "Purchase Successful!",
        description: "You've acquired a new item!",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <div>Loading shop items...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="shop p-4 bg-gray-100 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Shop</h2>
      <p className="mb-4">Your Coins: {playerCoins}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shopItems.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow">
            <TeddyCard teddy={item.teddy} />
            <p className="mt-2">Price: {item.price} coins</p>
            <Button
              onClick={() => purchaseMutation.mutate(item.id)}
              disabled={playerCoins < item.price || purchaseMutation.isLoading}
              className="mt-2"
            >
              Purchase
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;