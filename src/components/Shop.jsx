import React from 'react';
import { Button } from "@/components/ui/button";

const Shop = () => {
  const shopItems = [
    { id: 1, name: 'Bear Pack', price: 100, description: 'Get 5 random bears' },
    { id: 2, name: 'Premium Skin', price: 200, description: 'Exclusive bear skin' },
    { id: 3, name: 'Energy Boost', price: 50, description: 'Get 3 extra energy points' },
  ];

  return (
    <div className="shop">
      <h2 className="text-2xl font-bold mb-4">Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopItems.map(item => (
          <div key={item.id} className="bg-purple-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
            <p className="text-sm mb-2">{item.description}</p>
            <p className="text-lg font-bold mb-2">{item.price} coins</p>
            <Button className="w-full">Buy</Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;