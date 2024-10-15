import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const Shop = ({ onExit }) => {
  const { toast } = useToast();

  const shopItems = [
    { id: 1, name: "Basic Pack", price: 100, description: "Contains 3 random teddies" },
    { id: 2, name: "Premium Pack", price: 250, description: "Contains 5 random teddies with a guaranteed rare" },
    { id: 3, name: "Legendary Pack", price: 500, description: "Contains 7 random teddies with a guaranteed legendary" },
  ];

  const handlePurchase = (item) => {
    // Here you would typically check if the player has enough coins and process the purchase
    toast({
      title: "Purchase Successful",
      description: `You bought the ${item.name}!`,
      variant: "success",
    });
  };

  return (
    <div className="shop">
      <h2 className="text-2xl font-bold mb-4">Teddy Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {shopItems.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{item.description}</p>
              <p className="font-bold mt-2">Price: {item.price} coins</p>
              <Button onClick={() => handlePurchase(item)} className="mt-2 w-full">
                Buy
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={onExit}>Exit Shop</Button>
    </div>
  );
};

export default Shop;