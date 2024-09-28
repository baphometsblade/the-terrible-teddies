import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Shop = () => {
  const [items, setItems] = useState([]);
  const [playerCoins, setPlayerCoins] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchShopItems();
    fetchPlayerCoins();
  }, []);

  const fetchShopItems = async () => {
    const { data, error } = await supabase.from('shop_items').select('*');
    if (error) console.error('Error fetching shop items:', error);
    else setItems(data);
  };

  const fetchPlayerCoins = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('players')
        .select('coins')
        .eq('id', user.id)
        .single();
      if (error) console.error('Error fetching player coins:', error);
      else setPlayerCoins(data.coins);
    }
  };

  const purchaseItem = async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to make a purchase.",
        variant: "destructive",
      });
      return;
    }
    
    if (playerCoins < item.price) {
      toast({
        title: "Insufficient Funds",
        description: "You don't have enough coins to purchase this item.",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.rpc('purchase_item', {
      item_id: item.id,
      user_id: user.id
    });

    if (error) {
      console.error('Error purchasing item:', error);
      toast({
        title: "Purchase Failed",
        description: "An error occurred while processing your purchase. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Purchase Successful",
        description: `You have successfully purchased ${item.name}!`,
        variant: "success",
      });
      setPlayerCoins(prevCoins => prevCoins - item.price);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Shop</h2>
      <p className="mb-4">Your Coins: {playerCoins}</p>
      <div className="grid grid-cols-3 gap-4">
        {items.map(item => (
          <div key={item.id} className="border p-4 rounded">
            <h3 className="text-lg font-semibold">{item.name}</h3>
            <p>{item.description}</p>
            <p className="font-bold mt-2">${item.price}</p>
            <Button onClick={() => purchaseItem(item)} className="mt-2">Purchase</Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;