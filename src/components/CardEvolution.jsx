import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { useEvolveCard } from '../integrations/supabase';

export const CardEvolution = ({ card, onEvolve }) => {
  const [isEvolving, setIsEvolving] = useState(false);
  const evolveCard = useEvolveCard();
  const { toast } = useToast();

  const handleEvolve = async () => {
    setIsEvolving(true);
    try {
      const evolvedCard = await evolveCard.mutateAsync(card.id);
      toast({
        title: "Card Evolved!",
        description: `${card.name} has evolved to ${evolvedCard.name}!`,
        variant: "success",
      });
      onEvolve(evolvedCard);
    } catch (error) {
      toast({
        title: "Evolution Failed",
        description: "Unable to evolve the card. Please try again.",
        variant: "destructive",
      });
    }
    setIsEvolving(false);
  };

  return (
    <Card className="w-64 bg-gradient-to-br from-purple-100 to-pink-100">
      <CardContent className="p-4">
        <img src={card.url} alt={card.name} className="w-full h-40 object-cover rounded mb-2" />
        <h3 className="text-lg font-bold mb-1">{card.name}</h3>
        <p className="text-sm mb-2">Level: {card.level}</p>
        <Button 
          onClick={handleEvolve} 
          disabled={isEvolving || card.level >= 3}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white"
        >
          {isEvolving ? "Evolving..." : "Evolve"}
        </Button>
      </CardContent>
    </Card>
  );
};