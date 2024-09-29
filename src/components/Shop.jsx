import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
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
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('purchase_item', { 
        p_user_id: user.id, 
        p_item_id: itemId 
      });
      
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

  if (isLoading) return <div>Loading shop...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopItems.map(item => (
          <div key={item.id} className="border p-4 rounded-lg">
            {item.type === 'teddy' ? (
              <TeddyCard teddy={item.teddy_data} />
            ) : (
              <div>
                <h3 className="text-xl font-bold">{item.name}</h3>
                <p>{item.description}</p>
              </div>
            )}
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