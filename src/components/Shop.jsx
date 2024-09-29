import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Shop = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: packs, isLoading, error } = useQuery({
    queryKey: ['teddyPacks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teddy_packs')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packId) => {
      const { data, error } = await supabase.rpc('purchase_teddy_pack', { pack_id: packId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('playerTeddies');
      toast({
        title: "Purchase Successful",
        description: "You've got new teddies in your collection!",
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

  if (isLoading) return <div className="text-center mt-8">Loading shop...</div>;
  if (error) return <div className="text-center mt-8 text-red-500">Error loading shop: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Teddy Shop</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packs && packs.map((pack) => (
          <div key={pack.id} className="border p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">{pack.name}</h2>
            <p className="mb-2">{pack.description}</p>
            <p className="mb-4">Price: {pack.price} coins</p>
            <Button onClick={() => purchaseMutation.mutate(pack.id)}>
              Buy Pack
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;