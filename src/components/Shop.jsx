import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Shop = () => {
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
      // Implement purchase logic here
      const { data, error } = await supabase
        .rpc('purchase_item', { item_id: itemId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Refresh shop items and player data
    },
  });

  if (isLoading) return <div>Loading shop...</div>;
  if (error) return <div>Error loading shop: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Terrible Teddies Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopItems.map(item => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{item.description}</p>
              <p className="font-bold mt-2">Price: {item.price} coins</p>
              <Button 
                onClick={() => purchaseMutation.mutate(item.id)}
                disabled={purchaseMutation.isLoading}
                className="mt-2"
              >
                Buy
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Shop;