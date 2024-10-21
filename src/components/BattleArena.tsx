import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TeddyCard, BattleState, WeatherEffect } from '../types/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { getAIMove } from '../utils/AIOpponent';

const weatherEffects: WeatherEffect[] = [
  {
    name: 'Sunny Day',
    description: 'All teddies gain +1 attack',
    effect: (state: BattleState) => ({
      ...state,
      playerField: state.playerField.map(card => ({ ...card, attack: card.attack + 1 })),
      opponentField: state.opponentField.map(card => ({ ...card, attack: card.attack + 1 })),
    }),
    duration: 3,
  },
  {
    name: 'Rainy Day',
    description: 'All teddies lose 1 energy at the start of their turn',
    effect: (state: BattleState) => ({
      ...state,
      playerEnergy: state.playerEnergy - 1,
      opponentEnergy: state.opponentEnergy - 1,
    }),
    duration: 3,
  },
  // Add more weather effects as needed
];

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
    playerCooldowns: {},
    opponentCooldowns: {},
    weatherEffect: null,
    turnCount: 0,
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
    if (battleState.currentTurn === 'player' && 
        battleState.playerEnergy >= card.specialAbility.energyCost &&
        !battleState.playerCooldowns[card.id]) {
      const updatedState = card.specialAbility.effect(battleState, card);
      setBattleState(prev => ({
        ...prev,
        ...updatedState,
        playerEnergy: prev.playerEnergy - card.specialAbility.energyCost,
        playerCooldowns: { ...prev.playerCooldowns, [card.id]: card.specialAbility.cooldown },
        battleLog: [...prev.battleLog, `${card.name} used ${card.specialAbility.name}`],
      }));
    }
  };

  const endTurn = () => {
    setBattleState(prev => {
      const newState = {
        ...prev,
        currentTurn: 'opponent',
        playerEnergy: prev.playerEnergy + 1,
        turnCount: prev.turnCount + 1,
        playerCooldowns: Object.fromEntries(
          Object.entries(prev.playerCooldowns).map(([id, cooldown]) => [id, Math.max(0, cooldown - 1)])
        ),
        battleLog: [...prev.battleLog, "Player ended their turn"],
      };

      // Apply weather effects
      if (newState.weatherEffect) {
        const weatherUpdates = newState.weatherEffect.effect(newState);
        Object.assign(newState, weatherUpdates);
        newState.weatherEffect.duration--;
        if (newState.weatherEffect.duration <= 0) {
          newState.weatherEffect = null;
          newState.battleLog.push("The weather has cleared");
        }
      }

      // Randomly apply new weather effect
      if (!newState.weatherEffect && Math.random() < 0.2) {
        newState.weatherEffect = weatherEffects[Math.floor(Math.random() * weatherEffects.length)];
        newState.battleLog.push(`The weather has changed to ${newState.weatherEffect.name}`);
      }

      return newState;
    });

    // AI opponent's turn
    setTimeout(aiTurn, 1000);
  };

  const aiTurn = () => {
    const aiMove = getAIMove(battleState);
    let newState = { ...battleState };

    switch (aiMove.action) {
      case 'play':
        if (aiMove.card) {
          newState = {
            ...newState,
            opponentField: [...newState.opponentField, aiMove.card],
            opponentHand: newState.opponentHand.filter(c => c.id !== aiMove.card?.id),
            opponentEnergy: newState.opponentEnergy - aiMove.card.energyCost,
            battleLog: [...newState.battleLog, `Opponent played ${aiMove.card.name}`],
          };
        }
        break;
      case 'attack':
        if (aiMove.card && aiMove.target) {
          const damage = Math.max(0, aiMove.card.attack - aiMove.target.defense);
          newState = {
            ...newState,
            playerHealth: newState.playerHealth - damage,
            playerField: newState.playerField.filter(c => c.id !== aiMove.target?.id),
            battleLog: [...newState.battleLog, `${aiMove.card.name} dealt ${damage} damage to ${aiMove.target.name}`],
          };
        }
        break;
      case 'useSpecial':
        if (aiMove.card) {
          const updatedState = aiMove.card.specialAbility.effect(newState, aiMove.card);
          newState = {
            ...newState,
            ...updatedState,
            opponentEnergy: newState.opponentEnergy - aiMove.card.specialAbility.energyCost,
            opponentCooldowns: { ...newState.opponentCooldowns, [aiMove.card.id]: aiMove.card.specialAbility.cooldown },
            battleLog: [...newState.battleLog, `${aiMove.card.name} used ${aiMove.card.specialAbility.name}`],
          };
        }
        break;
    }

    // End AI turn
    newState = {
      ...newState,
      currentTurn: 'player',
      playerEnergy: newState.playerEnergy + 1,
      turnCount: newState.turnCount + 1,
      opponentCooldowns: Object.fromEntries(
        Object.entries(newState.opponentCooldowns).map(([id, cooldown]) => [id, Math.max(0, cooldown - 1)])
      ),
      battleLog: [...newState.battleLog, "Opponent ended their turn"],
    };

    // Apply weather effects
    if (newState.weatherEffect) {
      const weatherUpdates = newState.weatherEffect.effect(newState);
      Object.assign(newState, weatherUpdates);
      newState.weatherEffect.duration--;
      if (newState.weatherEffect.duration <= 0) {
        newState.weatherEffect = null;
        newState.battleLog.push("The weather has cleared");
      }
    }

    setBattleState(newState);
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
          <>
            <Button onClick={() => playCard(card)} disabled={battleState.playerEnergy < card.energyCost}>
              Play
            </Button>
            <Button onClick={() => useSpecialAbility(card)} disabled={
              battleState.playerEnergy < card.specialAbility.energyCost || 
              battleState.playerCooldowns[card.id] > 0
            }>
              {card.specialAbility.name}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (isLoadingPlayerDeck) return <div>Loading battle...</div>;

  return (
    <div className="battle-arena p-4">
      <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
      {battleState.weatherEffect && (
        <div className="mb-4 p-2 bg-blue-100 rounded">
          <h3 className="font-semibold">{battleState.weatherEffect.name}</h3>
          <p>{battleState.weatherEffect.description}</p>
          <p>Duration: {battleState.weatherEffect.duration} turns</p>
        </div>
      )}
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
        <ul className="list-disc list-inside max-h-40 overflow-y-auto">
          {battleState.battleLog.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BattleArena;