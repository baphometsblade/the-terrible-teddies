import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from '../TeddyCard';
import BattleLog from './BattleLog';
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import { calculateDamage, calculateSpecialMoveDamage, calculateDefenseBoost, isActionSuccessful } from '../../utils/battleUtils';
import { captureEvent } from '../../utils/posthog';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd, isAIOpponent = true }) => {
  const [battleState, setBattleState] = useState({
    playerHealth: 30,
    opponentHealth: 30,
    playerStuffing: 3,
    opponentStuffing: 3,
    playerDefenseBoost: 0,
    opponentDefenseBoost: 0,
    currentTurn: 'player',
    roundCount: 1,
    battleLog: [],
  });

  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);

  const { toast } = useToast();

  useEffect(() => {
    if (!playerTeddy || !opponentTeddy) {
      toast({
        title: "Error",
        description: "Unable to start battle. Missing teddy information.",
        variant: "destructive",
      });
      onBattleEnd('error');
      return;
    }
    initializeHands();
  }, [playerTeddy, opponentTeddy]);

  const initializeHands = () => {
    setPlayerHand([
      { id: 1, name: "Spanking Spree", type: "action", stuffingCost: 2, effect: "damage", value: 3 },
      { id: 2, name: "Furry Handcuffs", type: "equipment", stuffingCost: 1, effect: "defense", value: 2 },
      { id: 3, name: "Seedy Motel", type: "location", stuffingCost: 1, effect: "stuffing", value: 1 },
    ]);
    setOpponentHand([
      { id: 4, name: "Naughty Nibble", type: "action", stuffingCost: 1, effect: "damage", value: 2 },
      { id: 5, name: "Leather Vest", type: "equipment", stuffingCost: 2, effect: "attack", value: 2 },
      { id: 6, name: "Red Light District", type: "location", stuffingCost: 2, effect: "health", value: 3 },
    ]);
  };

  const battleActionMutation = useMutation({
    mutationFn: async ({ action, cardId }) => {
      if (isAIOpponent) {
        return simulateAIAction(action, cardId);
      } else {
        const { data, error } = await supabase.rpc('battle_action', {
          player_teddy_id: playerTeddy?.id || null,
          opponent_teddy_id: opponentTeddy?.id || null,
          action: action,
          card_id: cardId,
          ...battleState,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      setBattleState(prev => ({
        ...prev,
        playerHealth: data.player_health,
        opponentHealth: data.opponent_health,
        playerStuffing: data.player_stuffing,
        opponentStuffing: data.opponent_stuffing,
        playerDefenseBoost: data.player_defense_boost,
        opponentDefenseBoost: data.opponent_defense_boost,
        currentTurn: data.next_turn,
        roundCount: data.round_count,
      }));
      addToBattleLog(data.battle_log);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const simulateAIAction = (playerAction, playerCardId) => {
    if (!playerTeddy || !opponentTeddy) {
      throw new Error("Missing teddy information");
    }

    let {
      playerHealth,
      opponentHealth,
      playerStuffing,
      opponentStuffing,
      playerDefenseBoost,
      opponentDefenseBoost,
      roundCount
    } = battleState;
    let battleLog = [];

    // Player action
    const playerCard = playerHand.find(card => card.id === playerCardId);
    if (playerCard && playerStuffing >= playerCard.stuffingCost) {
      playerStuffing -= playerCard.stuffingCost;
      if (playerCard.effect === 'damage') {
        const damage = calculateDamage(playerTeddy.attack + playerCard.value, opponentTeddy.defense + opponentDefenseBoost);
        opponentHealth -= damage;
        battleLog.push(`You used ${playerCard.name} for ${damage} damage!`);
      } else if (playerCard.effect === 'defense') {
        playerDefenseBoost += playerCard.value;
        battleLog.push(`You used ${playerCard.name} to increase your defense by ${playerCard.value}!`);
      } else if (playerCard.effect === 'stuffing') {
        playerStuffing += playerCard.value;
        battleLog.push(`You used ${playerCard.name} to gain ${playerCard.value} stuffing!`);
      }
      setPlayerHand(prev => prev.filter(card => card.id !== playerCardId));
    }

    // AI action
    const aiCard = opponentHand[Math.floor(Math.random() * opponentHand.length)];
    if (aiCard && opponentStuffing >= aiCard.stuffingCost) {
      opponentStuffing -= aiCard.stuffingCost;
      if (aiCard.effect === 'damage') {
        const damage = calculateDamage(opponentTeddy.attack + aiCard.value, playerTeddy.defense + playerDefenseBoost);
        playerHealth -= damage;
        battleLog.push(`Opponent used ${aiCard.name} for ${damage} damage!`);
      } else if (aiCard.effect === 'attack') {
        opponentTeddy.attack += aiCard.value;
        battleLog.push(`Opponent used ${aiCard.name} to increase their attack by ${aiCard.value}!`);
      } else if (aiCard.effect === 'health') {
        opponentHealth = Math.min(30, opponentHealth + aiCard.value);
        battleLog.push(`Opponent used ${aiCard.name} to heal for ${aiCard.value}!`);
      }
      setOpponentHand(prev => prev.filter(card => card.id !== aiCard.id));
    }

    roundCount++;

    return {
      player_health: playerHealth,
      opponent_health: opponentHealth,
      player_stuffing: playerStuffing,
      opponent_stuffing: opponentStuffing,
      player_defense_boost: playerDefenseBoost,
      opponent_defense_boost: opponentDefenseBoost,
      next_turn: 'player',
      round_count: roundCount,
      battle_log: battleLog.join('\n'),
    };
  };

  useEffect(() => {
    const { playerHealth, opponentHealth } = battleState;
    if (playerHealth <= 0 || opponentHealth <= 0) {
      onBattleEnd(playerHealth > opponentHealth ? 'win' : 'lose');
      captureEvent('Battle_Ended', { result: playerHealth > opponentHealth ? 'win' : 'lose' });
    }
  }, [battleState.playerHealth, battleState.opponentHealth]);

  const handleAction = (action, cardId) => {
    if (battleState.currentTurn !== 'player') return;
    battleActionMutation.mutate({ action, cardId });
    captureEvent('Player_Action', { action, cardId });
  };

  const addToBattleLog = (logEntry) => {
    setBattleState(prev => ({
      ...prev,
      battleLog: [...prev.battleLog, logEntry],
    }));
  };

  if (!playerTeddy || !opponentTeddy) {
    return <div>Error: Missing teddy information. Unable to start battle.</div>;
  }

  return (
    <div className="battle-arena p-4 bg-gray-100 rounded-lg">
      <BattleField
        playerTeddy={playerTeddy}
        opponentTeddy={opponentTeddy}
        playerHealth={battleState.playerHealth}
        opponentHealth={battleState.opponentHealth}
        playerStuffing={battleState.playerStuffing}
        opponentStuffing={battleState.opponentStuffing}
        playerDefenseBoost={battleState.playerDefenseBoost}
        opponentDefenseBoost={battleState.opponentDefenseBoost}
        currentTurn={battleState.currentTurn}
        roundCount={battleState.roundCount}
      />
      <div className="player-hand mt-4">
        <h3 className="text-xl font-bold mb-2">Your Hand</h3>
        <div className="flex space-x-2">
          {playerHand.map(card => (
            <Button
              key={card.id}
              onClick={() => handleAction('playCard', card.id)}
              disabled={battleState.currentTurn !== 'player' || battleState.playerStuffing < card.stuffingCost}
            >
              {card.name} ({card.stuffingCost} SP)
            </Button>
          ))}
        </div>
      </div>
      <BattleLog log={battleState.battleLog} />
    </div>
  );
};

export default Battle;