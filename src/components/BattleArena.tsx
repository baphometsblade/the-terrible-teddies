import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TeddyCard, BattleState } from '../types/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { getAIMove } from '../utils/AIOpponent';
import { playCard, attack, useSpecialAbility, endTurn } from '../utils/battleActions';
import { getRandomWeather } from '../utils/weatherEffects';

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
    playerStunned: false,
    opponentStunned: false,
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
        weatherEffect: getRandomWeather(),
      }));
    }
  }, [playerDeck]);

  const handlePlayCard = (card: TeddyCard) => {
    if (battleState.currentTurn === 'player' && battleState.playerEnergy >= card.energyCost) {
      setBattleState(prev => playCard(prev, card, true));
    }
  };

  const handleAttack = (attackingCard: TeddyCard, targetCard: TeddyCard) => {
    if (battleState.currentTurn === 'player') {
      setBattleState(prev => attack(prev, attackingCard, targetCard, true));
    }
  };

  const handleUseSpecialAbility = (card: TeddyCard) => {
    if (battleState.currentTurn === 'player' && 
        battleState.playerEnergy >= card.specialAbility.energyCost &&
        !battleState.playerCooldowns[card.id]) {
      setBattleState(prev => useSpecialAbility(prev, card, true));
    }
  };

  const handleEndTurn = () => {
    setBattleState(prev => endTurn(prev));
    setTimeout(aiTurn, 1000);
  };

  const aiTurn = () => {
    let newState = { ...battleState };
    const aiMove = getAIMove(newState);

    switch (aiMove.action) {
      case 'play':
        if (aiMove.card) {
          newState = playCard(newState, aiMove.card, false);
        }
        break;
      case 'attack':
        if (aiMove.card && aiMove.target) {
          newState = attack(newState, aiMove.card, aiMove.target, false);
        }
        break;
      case 'useSpecial':
        if (aiMove.card) {
          newState = useSpecialAbility(newState, aiMove.card, false);
        }
        break;
    }

    newState = endTurn(newState);
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
            <Button onClick={() => handlePlayCard(card)} disabled={battleState.playerEnergy < card.energyCost}>
              Play
            </Button>
            <Button onClick={() => handleUseSpecialAbility(card)} disabled={
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
        <Button onClick={handleEndTurn} disabled={battleState.currentTurn !== 'player'}>End Turn</Button>
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