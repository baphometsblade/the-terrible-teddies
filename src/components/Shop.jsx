import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';

const Shop = () => {
  const { toast } = useToast();

  const { data: shopItems, isLoading, error } = useQuery({
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
      const { data, error } = await supabase.rpc('purchase_item', { item_id: itemId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Purchase Successful",
        description: `You've purchased ${data.item_name}!`,
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Teddy Shop</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shopItems.map(item => (
          <div key={item.id} className="border p-4 rounded">
            <TeddyCard teddy={item.teddy} />
            <p className="mt-2">Price: {item.price} coins</p>
            <Button
              onClick={() => purchaseMutation.mutate(item.id)}
              disabled={purchaseMutation.isLoading}
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