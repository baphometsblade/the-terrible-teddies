import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { useUserStats, useUpdateUserStats } from '../integrations/supabase/index.js';

const shopItems = [
  { id: 1, name: 'Extra Card Pack', description: 'Get 5 random cards', cost: 100 },
  { id: 2, name: 'HP Boost', description: 'Increase max HP by 5', cost: 200 },
  { id: 3, name: 'Lucky Charm', description: 'Increase chance of rare cards', cost: 300 },
  { id: 4, name: 'Energy Drink', description: 'Start games with +1 energy', cost: 400 },
];

export const Shop = ({ onClose }) => {
  const { data: userStats, isLoading, error } = useUserStats();
  const updateUserStats = useUpdateUserStats();
  const { toast } = useToast();
  const [purchasedItems, setPurchasedItems] = useState([]);

  const handlePurchase = (item) => {
    if (userStats.coins < item.cost) {
      toast({
        title: "Insufficient Coins",
        description: "You don't have enough coins for this purchase.",
        variant: "destructive",
      });
      return;
    }

    updateUserStats.mutate(
      { coins: userStats.coins - item.cost },
      {
        onSuccess: () => {
          setPurchasedItems([...purchasedItems, item.id]);
          toast({
            title: "Purchase Successful",
            description: `You've purchased ${item.name}!`,
            variant: "success",
          });
        },
        onError: (error) => {
          toast({
            title: "Purchase Failed",
            description: "There was an error processing your purchase.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) return <div>Loading shop...</div>;
  if (error) return <div>Error loading shop: {error.message}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="shop-container p-6 bg-white rounded-lg shadow-xl"
    >
      <h2 className="text-2xl font-bold mb-4 text-purple-800">Terrible Teddies Shop</h2>
      <p className="mb-4 text-lg text-gray-700">Your Coins: {userStats.coins}</p>
      <div className="grid grid-cols-2 gap-4">
        {shopItems.map((item) => (
          <Card key={item.id} className="bg-gradient-to-br from-pink-100 to-purple-100">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-2 text-purple-700">{item.name}</h3>
              <p className="text-sm mb-2 text-gray-600">{item.description}</p>
              <p className="text-md font-bold mb-2 text-yellow-600">{item.cost} coins</p>
              <Button
                onClick={() => handlePurchase(item)}
                disabled={userStats.coins < item.cost || purchasedItems.includes(item.id)}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
              >
                {purchasedItems.includes(item.id) ? 'Purchased' : 'Buy'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={onClose} className="mt-6 bg-gray-500 hover:bg-gray-600 text-white">
        Close Shop
      </Button>
    </motion.div>
  );
};