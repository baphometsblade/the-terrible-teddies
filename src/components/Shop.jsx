import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';

const fetchShopTeddies = async () => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('*')
    .limit(5);
  if (error) throw error;
  return data;
};

const Shop = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: shopTeddies, isLoading, error } = useQuery({
    queryKey: ['shopTeddies'],
    queryFn: fetchShopTeddies,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (teddyId) => {
      const { data, error } = await supabase
        .from('player_teddies')
        .insert([{ teddy_id: teddyId }]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('playerDeck');
      toast({
        title: "Purchase Successful",
        description: "You've added a new teddy to your collection!",
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

  if (isLoading) return <div>Loading shop...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Teddy Shop</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopTeddies.map(teddy => (
          <div key={teddy.id} className="flex flex-col items-center">
            <TeddyCard teddy={teddy} />
            <Button
              onClick={() => purchaseMutation.mutate(teddy.id)}
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