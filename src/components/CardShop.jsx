import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShoppingCart } from 'lucide-react';
import { useShopCards } from '../integrations/supabase';

const purchaseCard = async (cardId) => {
  const { data, error } = await supabase
    .from('user_decks')
    .select('deck')
    .single();
  if (error) throw error;

  const updatedDeck = [...data.deck, cardId];
  const { error: updateError } = await supabase
    .from('user_decks')
    .update({ deck: updatedDeck })
    .eq('user_id', supabase.auth.user().id);
  if (updateError) throw updateError;

  return updatedDeck;
};

export const CardShop = ({ onExit }) => {
  const [selectedCard, setSelectedCard] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shopCards, isLoading, error } = useShopCards();

  const purchaseMutation = useMutation({
    mutationFn: purchaseCard,
    onSuccess: () => {
      queryClient.invalidateQueries('userDeck');
      toast({
        title: "Card Purchased!",
        description: "The card has been added to your deck.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto" />;
  if (error) return (
    <div className="text-center">
      <p className="text-red-500 mb-4">Error loading shop cards. Please try again later.</p>
      <Button onClick={() => queryClient.invalidateQueries('shopCards')}>Retry</Button>
    </div>
  );

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Card Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shopCards && shopCards.map((card) => (
          <Card key={card.id} className="cursor-pointer" onClick={() => setSelectedCard(card)}>
            <CardContent className="p-4">
              <img src={card.url} alt={card.name} className="w-full h-40 object-cover rounded mb-2" />
              <h3 className="text-lg font-semibold">{card.name}</h3>
              <p className="text-sm text-gray-600">{card.type}</p>
              <p className="text-sm text-gray-600">Price: {card.price} coins</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-4">
              <img src={selectedCard.url} alt={selectedCard.name} className="w-full h-60 object-cover rounded mb-4" />
              <h3 className="text-xl font-bold mb-2">{selectedCard.name}</h3>
              <p className="text-gray-600 mb-2">{selectedCard.type}</p>
              <p className="text-gray-600 mb-4">Price: {selectedCard.price} coins</p>
              <div className="flex justify-between">
                <Button onClick={() => setSelectedCard(null)}>Close</Button>
                <Button onClick={() => purchaseMutation.mutate(selectedCard.id)} disabled={purchaseMutation.isLoading}>
                  {purchaseMutation.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="w-4 h-4 mr-2" />
                  )}
                  Purchase
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <Button onClick={onExit} className="mt-4">Back to Menu</Button>
    </div>
  );
};
