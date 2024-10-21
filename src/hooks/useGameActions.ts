import { useState } from 'react';
import { TeddyCard } from '../types/types';
import { useCardActions } from './useCardActions';
import { useBattleActions } from './useBattleActions';
import { useToast } from "@/components/ui/use-toast";

export const useGameActions = () => {
  const [playerHand, setPlayerHand] = useState<TeddyCard[]>([]);
  const [playerField, setPlayerField] = useState<TeddyCard[]>([]);
  const [opponentField, setOpponentField] = useState<TeddyCard[]>([]);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentHealth, setOpponentHealth] = useState(20);
  const { toast } = useToast();

  const { playCard, drawCard } = useCardActions(playerHand, setPlayerHand, playerField, setPlayerField, playerEnergy, setPlayerEnergy);
  const { attack, useSpecialAbility } = useBattleActions(playerField, opponentField, setOpponentHealth, setPlayerEnergy);

  const endTurn = () => {
    // Implement end turn logic here
    toast({
      title: "Turn Ended",
      description: "Your turn has ended",
      variant: "info",
    });
  };

  return {
    playerHand,
    playerField,
    opponentField,
    playerEnergy,
    opponentHealth,
    playCard,
    drawCard,
    attack,
    useSpecialAbility,
    endTurn,
  };
};