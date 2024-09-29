import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Shop = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries(['shopItems']);
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Teddy Shop</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shopItems.map(item => (
          <Card key={item.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="mb-2">{item.description}</p>
              <p className="font-bold mb-4">Price: {item.price} coins</p>
              <Button 
                onClick={() => purchaseMutation.mutate(item.id)}
                disabled={purchaseMutation.isLoading}
                className="w-full"
              >
                {purchaseMutation.isLoading ? 'Purchasing...' : 'Purchase'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Shop;