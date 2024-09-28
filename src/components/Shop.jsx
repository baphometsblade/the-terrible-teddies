import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";

const Shop = () => {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchShopItems();
  }, []);

  const fetchShopItems = async () => {
    const { data, error } = await supabase.from('shop_items').select('*');
    if (error) console.error('Error fetching shop items:', error);
    else setItems(data);
  };

  const purchaseItem = async (item) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user) {
      setMessage('Please sign in to make a purchase.');
      return;
    }
    
    // Here you would implement the actual purchase logic
    // For now, we'll just simulate a successful purchase
    setMessage(`Successfully purchased ${item.name}!`);
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Shop</h2>
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
      {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
    </div>
  );
};

export default Shop;