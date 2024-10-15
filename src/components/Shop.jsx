import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const Shop = ({ onExit }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: playerCoins = 0, isLoading: isLoadingCoins } = useQuery({
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

  const { data: shopItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['shopItems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_items')
        .select('*');
      if (error) throw error;
      return data;
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
        title: "Purchase Successful",
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

  const handlePurchase = (item) => {
    if (playerCoins < item.price) {
      toast({
        title: "Insufficient Coins",
        description: "You don't have enough coins to purchase this item.",
        variant: "destructive",
      });
      return;
    }
    purchaseMutation.mutate(item.id);
  };

  if (isLoadingCoins || isLoadingItems) return <div>Loading shop data...</div>;

  return (
    <div className="shop">
      <h2 className="text-2xl font-bold mb-4">Teddy Shop</h2>
      <p className="mb-4">Your Coins: {playerCoins}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {shopItems.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{item.description}</p>
              <p className="font-bold mt-2">Price: {item.price} coins</p>
              <Button 
                onClick={() => handlePurchase(item)} 
                className="mt-2 w-full"
                disabled={playerCoins < item.price}
              >
                Buy
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={onExit}>Exit Shop</Button>
    </div>
  );
};

export default Shop;