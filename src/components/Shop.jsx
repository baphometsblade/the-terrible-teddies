import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';

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
      // Implement purchase logic here
      // For now, we'll just show a success message
      toast({
        title: "Purchase Successful",
        description: "You've purchased a new item!",
        variant: "success",
      });
    },
  });

  if (isLoading) return <div>Loading shop...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {shopItems.map((item) => (
        <div key={item.id} className="flex flex-col items-center">
          <TeddyCard teddy={item} />
          <Button 
            onClick={() => purchaseMutation.mutate(item.id)}
            className="mt-2"
          >
            Buy for {item.price} coins
          </Button>
        </div>
      ))}
    </div>
  );
};

export default Shop;