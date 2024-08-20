import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { useEvolveCard } from '../integrations/supabase';
import { motion } from 'framer-motion';

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
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card className="w-64 bg-gradient-to-br from-purple-100 to-pink-100 shadow-lg">
        <CardContent className="p-4">
          <img src={card.url} alt={card.name} className="w-full h-40 object-cover rounded mb-2" />
          <h3 className="text-lg font-bold mb-1 text-purple-800">{card.name}</h3>
          <p className="text-sm mb-2 text-purple-600">Level: {card.level}</p>
          <p className="text-xs mb-2 text-gray-600">{card.description}</p>
          <Button 
            onClick={handleEvolve} 
            disabled={isEvolving || card.level >= 3}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-colors duration-300"
          >
            {isEvolving ? "Evolving..." : card.level >= 3 ? "Max Level" : "Evolve"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};