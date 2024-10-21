import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TeddyCard, BattleState } from '../types/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const BattleArena: React.FC = () => {
  const [battleState, setBattleState] = useState<BattleState>({
    playerHealth: 30,
    opponentHealth: 30,
    playerEnergy: 1,
    opponentEnergy: 1,
    playerField: [],
    opponentField: [],
    playerHand: [],
    opponentHand: [],
    currentTurn: 'player',
    battleLog: [],
  });

  const { toast } = useToast();

  const { data: playerDeck, isLoading: isLoadingPlayerDeck } = useQuery({
    queryKey: ['playerDeck'],
    queryFn: async () => {
      const { data, error } = await supabase.from('decks').select('*').eq('user_id', supabase.auth.user()?.id).single();
      if (error) throw error;
      return data.cards as TeddyCard[];
    },
  });

  useEffect(() => {
    if (playerDeck) {
      const shuffledDeck = [...playerDeck].sort(() => Math.random() - 0.5);
      setBattleState(prev => ({
        ...prev,
        playerHand: shuffledDeck.slice(0, 5),
        opponentHand: shuffledDeck.slice(5, 10), // Temporary: opponent uses the same deck
      }));
    }
  }, [playerDeck]);

  const playCard = (card: TeddyCard) => {
    if (battleState.currentTurn === 'player' && battleState.playerEnergy >= card.energyCost) {
      setBattleState(prev => ({
        ...prev,
        playerField: [...prev.playerField, card],
        playerHand: prev.playerHand.filter(c => c.id !== card.id),
        playerEnergy: prev.playerEnergy - card.energyCost,
        battleLog: [...prev.battleLog, `Player played ${card.name}`],
      }));
    }
  };

  const attack = (attackingCard: TeddyCard, targetCard: TeddyCard) => {
    if (battleState.currentTurn === 'player') {
      const damage = Math.max(0, attackingCard.attack - targetCard.defense);
      setBattleState(prev => ({
        ...prev,
        opponentHealth: prev.opponentHealth - damage,
        opponentField: prev.opponentField.filter(c => c.id !== targetCard.id),
        battleLog: [...prev.battleLog, `${attackingCard.name} dealt ${damage} damage to ${targetCard.name}`],
      }));
    }
  };

  const useSpecialAbility = (card: TeddyCard) => {
    if (battleState.currentTurn === 'player') {
      const updatedState = card.specialAbility.effect(battleState);
      setBattleState(prev => ({
        ...prev,
        ...updatedState,
        battleLog: [...prev.battleLog, `${card.name} used ${card.specialAbility.name}`],
      }));
    }
  };

  const endTurn = () => {
    setBattleState(prev => ({
      ...prev,
      currentTurn: 'opponent',
      playerEnergy: prev.playerEnergy + 1,
      battleLog: [...prev.battleLog, "Player ended their turn"],
    }));
    // Implement AI opponent's turn here
  };

  const renderCard = (card: TeddyCard, isPlayable: boolean) => (
    <Card key={card.id} className="w-32 h-48 m-2">
      <CardHeader>
        <CardTitle>{card.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Attack: {card.attack}</p>
        <p>Defense: {card.defense}</p>
        <p>Energy: {card.energyCost}</p>
        {isPlayable && (
          <Button onClick={() => playCard(card)} disabled={battleState.playerEnergy < card.energyCost}>
            Play
          </Button>
        )}
      </CardContent>
    </Card>
  );

  if (isLoadingPlayerDeck) return <div>Loading battle...</div>;

  return (
    <div className="battle-arena p-4">
      <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Opponent</h3>
        <p>Health: {battleState.opponentHealth}</p>
        <p>Energy: {battleState.opponentEnergy}</p>
        <div className="flex flex-wrap">
          {battleState.opponentField.map(card => renderCard(card, false))}
        </div>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Your Field</h3>
        <div className="flex flex-wrap">
          {battleState.playerField.map(card => renderCard(card, false))}
        </div>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Your Hand</h3>
        <p>Health: {battleState.playerHealth}</p>
        <p>Energy: {battleState.playerEnergy}</p>
        <div className="flex flex-wrap">
          {battleState.playerHand.map(card => renderCard(card, true))}
        </div>
      </div>
      <div className="flex space-x-2">
        <Button onClick={endTurn} disabled={battleState.currentTurn !== 'player'}>End Turn</Button>
      </div>
      <div className="mt-4">
        <h3 className="text-xl font-semibold">Battle Log</h3>
        <ul className="list-disc list-inside">
          {battleState.battleLog.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BattleArena;