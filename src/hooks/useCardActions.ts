import { useState } from 'react';
import { TeddyCard } from '../types/types';
import { supabase } from '../lib/supabase';
import { useToast } from "@/components/ui/use-toast";

export const useCardActions = (playerHand: TeddyCard[], setPlayerHand: React.Dispatch<React.SetStateAction<TeddyCard[]>>, playerField: TeddyCard[], setPlayerField: React.Dispatch<React.SetStateAction<TeddyCard[]>>, playerEnergy: number, setPlayerEnergy: React.Dispatch<React.SetStateAction<number>>) => {
  const { toast } = useToast();

  const playCard = (card: TeddyCard) => {
    if (playerEnergy < card.energyCost) {
      toast({
        title: "Not enough energy",
        description: `You need ${card.energyCost} energy to play this card.`,
        variant: "destructive",
      });
      return;
    }

    setPlayerHand(prevHand => prevHand.filter(c => c.id !== card.id));
    setPlayerField(prevField => [...prevField, card]);
    setPlayerEnergy(prevEnergy => prevEnergy - card.energyCost);

    toast({
      title: "Card Played",
      description: `You played ${card.name}`,
      variant: "success",
    });
  };

  const drawCard = async () => {
    const { data, error } = await supabase
      .from('player_teddies')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      toast({
        title: "Error drawing card",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setPlayerHand(prevHand => [...prevHand, data]);
    toast({
      title: "Card Drawn",
      description: `You drew ${data.name}`,
      variant: "success",
    });
  };

  return { playCard, drawCard };
};