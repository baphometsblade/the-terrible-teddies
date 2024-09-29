import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Shop = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: shopTeddies, isLoading, error } = useQuery({
    queryKey: ['shopTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (teddyId) => {
      const { data, error } = await supabase
        .from('player_teddies')
        .insert({ teddy_id: teddyId, player_id: (await supabase.auth.getUser()).data.user.id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('playerTeddies');
      toast({
        title: "Purchase Successful",
        description: "New teddy added to your collection!",
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {shopTeddies.map(teddy => (
        <div key={teddy.id}>
          <TeddyCard teddy={teddy} />
          <Button onClick={() => purchaseMutation.mutate(teddy.id)} className="w-full mt-2">
            Purchase
          </Button>
        </div>
      ))}
    </div>
  );
};

export default Shop;