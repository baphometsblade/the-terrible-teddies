import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const fetchShopItems = async () => {
  const { data, error } = await supabase.from('shop_items').select('*');
  if (error) throw error;
  return data;
};

const Shop = () => {
  const { data: shopItems, isLoading, error } = useQuery({
    queryKey: ['shopItems'],
    queryFn: fetchShopItems,
  });

  const { toast } = useToast();

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

  if (isLoading) return <div>Loading shop items...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies Shop</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopItems.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-2">{item.name}</h2>
            <p className="mb-2">{item.description}</p>
            <p className="mb-4">Price: {item.price} coins</p>
            <Button onClick={() => purchaseMutation.mutate(item.id)}>
              Purchase
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;