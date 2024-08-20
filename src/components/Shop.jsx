import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { useUserStats, useUpdateUserStats } from '../integrations/supabase';
import { ShoppingCart, Package, Heart, Zap, Shield } from 'lucide-react';

const shopItems = [
  { id: 1, name: 'Extra Card Pack', description: 'Get 5 random cards', cost: 100, icon: <Package className="w-8 h-8 text-purple-500" /> },
  { id: 2, name: 'HP Boost', description: 'Increase max HP by 5', cost: 200, icon: <Heart className="w-8 h-8 text-red-500" /> },
  { id: 3, name: 'Lucky Charm', description: 'Increase chance of rare cards', cost: 300, icon: <ShoppingCart className="w-8 h-8 text-yellow-500" /> },
  { id: 4, name: 'Energy Drink', description: 'Start games with +1 energy', cost: 400, icon: <Zap className="w-8 h-8 text-blue-500" /> },
  { id: 5, name: 'Teddy Armor', description: 'Reduce damage taken by 10%', cost: 500, icon: <Shield className="w-8 h-8 text-green-500" /> },
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

  if (isLoading) return <div className="text-center text-2xl text-purple-600">Loading shop...</div>;
  if (error) return <div className="text-center text-2xl text-red-600">Error loading shop: {error.message}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="shop-container p-8 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg shadow-xl"
    >
      <h2 className="text-4xl font-bold mb-6 text-center text-purple-800">Terrible Teddies Shop</h2>
      <div className="flex justify-between items-center mb-8">
        <p className="text-2xl font-bold text-yellow-600">Your Coins: {userStats.coins}</p>
        <Button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white">
          Close Shop
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shopItems.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex justify-center mb-4">
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-purple-700">{item.name}</h3>
                <p className="text-sm mb-4 text-gray-600">{item.description}</p>
                <div className="flex justify-between items-center">
                  <p className="text-lg font-bold text-yellow-600">{item.cost} coins</p>
                  <Button
                    onClick={() => handlePurchase(item)}
                    disabled={userStats.coins < item.cost || purchasedItems.includes(item.id)}
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    {purchasedItems.includes(item.id) ? 'Purchased' : 'Buy'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};