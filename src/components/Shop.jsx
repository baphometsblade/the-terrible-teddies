import React from 'react';
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const fetchShopCards = async () => {
  const { data, error } = await supabase.from('terrible_teddies').select('*').limit(5);
  if (error) throw error;
  return data;
};

export const Shop = () => {
  const { data: shopCards, isLoading, error } = useQuery({
    queryKey: ['shopCards'],
    queryFn: fetchShopCards,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (cardId) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from('player_teddies')
        .insert({ player_id: user.id, teddy_id: cardId });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading shop...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Teddy Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopCards.map((card) => (
          <div key={card.id} className="border p-4 rounded-lg">
            <h3 className="text-lg font-bold">{card.name}</h3>
            <p>{card.description}</p>
            <p>Attack: {card.attack}</p>
            <p>Defense: {card.defense}</p>
            <Button
              onClick={() => purchaseMutation.mutate(card.id)}
              className="mt-2"
            >
              Purchase
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;