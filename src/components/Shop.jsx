import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Shop = () => {
  const { toast } = useToast();
  const { data: shopItems, isLoading, error } = useQuery({
    queryKey: ['shopItems'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shop_items').select('*');
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
    onSuccess: () => {
      toast({
        title: "Purchase successful",
        description: "Your item has been added to your collection!",
      });
    },
    onError: (error) => {
      toast({
        title: "Purchase failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <div>Loading shop items...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {shopItems.map(item => (
        <div key={item.id} className="border p-4 rounded-lg">
          <h3 className="text-lg font-bold">{item.name}</h3>
          <p>{item.description}</p>
          <p className="font-bold mt-2">Price: {item.price} coins</p>
          <Button onClick={() => purchaseMutation.mutate(item.id)} className="mt-2">
            Purchase
          </Button>
        </div>
      ))}
    </div>
  );
};

export default Shop;