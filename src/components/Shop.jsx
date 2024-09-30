import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useToast } from "@/components/ui/use-toast";

const Shop = () => {
  const [shopTeddies, setShopTeddies] = useState([]);
  const [playerCoins, setPlayerCoins] = useState(100);
  const { toast } = useToast();

  useEffect(() => {
    // Simulating fetching shop teddies from an API or database
    setShopTeddies([
      { id: 4, name: "Captain Cuddles", attack: 6, defense: 7, specialMove: "Hug of Doom", price: 50 },
      { id: 5, name: "Sir Fluffington", attack: 8, defense: 5, specialMove: "Royal Decree", price: 75 },
      { id: 6, name: "Ninja Nuzzles", attack: 9, defense: 3, specialMove: "Shadow Snuggle", price: 100 },
    ]);
  }, []);

  const handlePurchase = (teddy) => {
    if (playerCoins >= teddy.price) {
      setPlayerCoins(prev => prev - teddy.price);
      setShopTeddies(prev => prev.filter(t => t.id !== teddy.id));
      toast({
        title: "Purchase Successful",
        description: `You bought ${teddy.name} for ${teddy.price} coins!`,
        variant: "success",
      });
    } else {
      toast({
        title: "Purchase Failed",
        description: "Not enough coins!",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Teddy Shop</h1>
      <p className="mb-4">Your Coins: {playerCoins}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopTeddies.map(teddy => (
          <div key={teddy.id} className="flex flex-col">
            <TeddyCard teddy={teddy} />
            <Button onClick={() => handlePurchase(teddy)} className="mt-2">
              Buy for {teddy.price} coins
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;