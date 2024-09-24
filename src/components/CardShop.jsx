import React from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const fetchShopCards = async () => {
  const { data, error } = await supabase.from('shop_cards').select('*');
  if (error) throw error;
  return data;
};

const purchaseCard = async (cardId) => {
  // Implement purchase logic here
  console.log('Purchasing card:', cardId);
};

export const CardShop = ({ onExit }) => {
  const { data: shopCards, isLoading, error } = useQuery({
    queryKey: ['shopCards'],
    queryFn: fetchShopCards,
  });

  const purchaseMutation = useMutation({
    mutationFn: purchaseCard,
    onSuccess: () => {
      console.log('Card purchased successfully');
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="card-shop">
      <h2 className="text-2xl font-bold mb-4">Card Shop</h2>
      <div className="grid grid-cols-5 gap-4 mb-8">
        {shopCards.map((card) => (
          <div key={card.id} className="relative">
            <TeddyCard card={card} />
            <Button
              onClick={() => purchaseMutation.mutate(card.id)}
              className="mt-2 w-full"
            >
              Buy ({card.price} coins)
            </Button>
          </div>
        ))}
      </div>
      <Button onClick={onExit}>Exit Shop</Button>
    </div>
  );
};
