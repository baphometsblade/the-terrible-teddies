import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetchShopItems = async () => {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*');
  if (error) throw error;
  return data;
};

const Shop = () => {
  const { data: shopItems, isLoading, error } = useQuery({
    queryKey: ['shop-items'],
    queryFn: fetchShopItems,
  });

  const handlePurchase = (item) => {
    // Implement purchase logic here
    console.log(`Purchased ${item.name} for ${item.price} coins`);
  };

  if (isLoading) return <div className="text-center mt-8">Loading shop...</div>;
  if (error) return <div className="text-center mt-8">Error loading shop: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-4 text-center">Terrible Teddies Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopItems && shopItems.map(item => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{item.description}</p>
              <p className="font-bold mt-2">Price: {item.price} coins</p>
              <Button 
                onClick={() => handlePurchase(item)}
                className="mt-2 w-full"
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