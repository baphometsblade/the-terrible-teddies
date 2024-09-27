import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from '../lib/supabase';

const Shop = () => {
  const [shopItems, setShopItems] = useState([]);
  const [playerCoins, setPlayerCoins] = useState(0);

  useEffect(() => {
    fetchShopItems();
    fetchPlayerCoins();
  }, []);

  const fetchShopItems = async () => {
    const { data, error } = await supabase
      .from('shop_items')
      .select('*');
    if (data) setShopItems(data);
    if (error) console.error('Error fetching shop items:', error);
  };

  const fetchPlayerCoins = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('coins')
      .single();
    if (data) setPlayerCoins(data.coins);
    if (error) console.error('Error fetching player coins:', error);
  };

  const handlePurchase = async (item) => {
    if (playerCoins >= item.price) {
      const { error } = await supabase
        .from('players')
        .update({ coins: playerCoins - item.price })
        .eq('id', 1); // Assuming player id is 1 for now

      if (error) {
        console.error('Error purchasing item:', error);
      } else {
        setPlayerCoins(prevCoins => prevCoins - item.price);
        alert(`You purchased ${item.name}!`);
      }
    } else {
      alert('Not enough coins!');
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Shop</h2>
      <p className="mb-4">Your Coins: {playerCoins}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shopItems.map((item) => (
          <div key={item.id} className="border p-2 rounded">
            <h3 className="font-semibold">{item.name}</h3>
            <p>Price: {item.price} coins</p>
            <Button onClick={() => handlePurchase(item)} className="mt-2">
              Buy
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;