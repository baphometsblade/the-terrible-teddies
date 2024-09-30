import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeddyCard from './TeddyCard';

const Shop = () => {
  const [activeTab, setActiveTab] = useState('packs');
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
    mutationFn: async (item) => {
      // Here you would typically make an API call to process the purchase
      // For now, we'll just simulate a successful purchase
      return new Promise((resolve) => setTimeout(() => resolve(item), 1000));
    },
    onSuccess: (item) => {
      toast({
        title: "Purchase Successful",
        description: `You bought ${item.name} for ${item.price} coins!`,
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

  const handlePurchase = (item) => {
    purchaseMutation.mutate(item);
  };

  if (isLoading) return <div>Loading shop...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const packs = shopItems.filter(item => item.type === 'pack');
  const cosmetics = shopItems.filter(item => item.type === 'cosmetic');
  const consumables = shopItems.filter(item => item.type === 'consumable');

  return (
    <div className="shop container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies Shop</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="packs">Packs</TabsTrigger>
          <TabsTrigger value="cosmetics">Cosmetics</TabsTrigger>
          <TabsTrigger value="consumables">Consumables</TabsTrigger>
        </TabsList>
        <TabsContent value="packs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packs.map(pack => (
              <div key={pack.id} className="border p-4 rounded-lg">
                <h3 className="font-bold text-xl mb-2">{pack.name}</h3>
                <p>{pack.description}</p>
                <Button onClick={() => handlePurchase(pack)} className="mt-4 w-full">
                  Buy for {pack.price} coins
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="cosmetics">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {cosmetics.map(cosmetic => (
              <div key={cosmetic.id} className="border p-4 rounded-lg">
                <img src={cosmetic.image_url} alt={cosmetic.name} className="w-full h-32 object-cover mb-2" />
                <h3 className="font-bold">{cosmetic.name}</h3>
                <p>{cosmetic.description}</p>
                <Button onClick={() => handlePurchase(cosmetic)} className="mt-2 w-full">
                  Buy for {cosmetic.price} coins
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="consumables">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {consumables.map(consumable => (
              <div key={consumable.id} className="border p-4 rounded-lg">
                <img src={consumable.image_url} alt={consumable.name} className="w-full h-32 object-cover mb-2" />
                <h3 className="font-bold">{consumable.name}</h3>
                <p>{consumable.description}</p>
                <Button onClick={() => handlePurchase(consumable)} className="mt-2 w-full">
                  Buy for {consumable.price} coins
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Shop;