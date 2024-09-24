import React from 'react';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const fetchShopCards = async () => {
  const { data, error } = await supabase.from('shop_cards').select('*');
  if (error) throw error;
  return data;
};

export const CardShop = ({ onExit }) => {
  const { data: shopCards, isLoading, error } = useQuery({
    queryKey: ['shopCards'],
    queryFn: fetchShopCards,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (cardId) => {
      // Implement purchase logic here
      console.log('Purchasing card:', cardId);
    },
  });

  if (isLoading) return <div>Loading shop...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="card-shop">
      <h2 className="text-2xl font-bold mb-4">Card Shop</h2>
      <div className="grid grid-cols-5 gap-4 mb-8">
        {shopCards.map((card) => (
          <div key={card.id} className="card">
            <img src={card.url} alt={card.name} className="w-full h-32 object-cover rounded mb-2" />
            <p className="text-sm mb-1">{card.name}</p>
            <p className="text-sm mb-2">Price: {card.price} coins</p>
            <Button
              onClick={() => purchaseMutation.mutate(card.id)}
              className="w-full"
            >
              Buy
            </Button>
          </div>
        ))}
      </div>
      <Button onClick={onExit}>Exit Shop</Button>
    </div>
  );
};
