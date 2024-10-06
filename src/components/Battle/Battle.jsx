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
    playerEnergy: 3,
    opponentEnergy: 3,
    currentTurn: 'player',
    battleLog: [],
  });

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
  }, [playerTeddy, opponentTeddy]);

  const addToBattleLog = (message) => {
    setBattleState(prev => ({
      ...prev,
      battleLog: [...prev.battleLog, message],
    }));
  };

  const battleActionMutation = useMutation({
    mutationFn: async ({ action }) => {
      if (isAIOpponent) {
        // Simulate AI action locally
        return simulateAIAction(action);
      } else {
        // Send action to server for multiplayer
        const { data, error } = await supabase.rpc('battle_action', {
          player_teddy_id: playerTeddy?.id,
          opponent_teddy_id: opponentTeddy?.id,
          action: action,
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
        playerEnergy: data.player_energy,
        opponentEnergy: data.opponent_energy,
        currentTurn: data.next_turn,
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

  const simulateAIAction = (playerAction) => {
    if (!playerTeddy || !opponentTeddy) {
      throw new Error("Missing teddy information");
    }

    let { playerHealth, opponentHealth, playerEnergy, opponentEnergy } = battleState;
    let battleLog = [];

    // Player action
    if (playerAction === 'attack') {
      const damage = calculateDamage(playerTeddy, opponentTeddy);
      opponentHealth -= damage;
      battleLog.push(`You attacked for ${damage} damage!`);
    } else if (playerAction === 'defend') {
      const defenseBoost = calculateDefenseBoost(playerTeddy);
      playerTeddy.defense += defenseBoost;
      battleLog.push(`You increased your defense by ${defenseBoost}!`);
    } else if (playerAction === 'special' && playerEnergy >= 2) {
      const specialDamage = calculateSpecialMoveDamage(playerTeddy);
      opponentHealth -= specialDamage;
      playerEnergy -= 2;
      battleLog.push(`You used your special move for ${specialDamage} damage!`);
    }

    // AI action
    const aiAction = calculateAIAction(opponentTeddy, playerTeddy, opponentEnergy);
    if (aiAction === 'attack') {
      const damage = calculateDamage(opponentTeddy, playerTeddy);
      playerHealth -= damage;
      battleLog.push(`Opponent attacked for ${damage} damage!`);
    } else if (aiAction === 'defend') {
      const defenseBoost = calculateDefenseBoost(opponentTeddy);
      opponentTeddy.defense += defenseBoost;
      battleLog.push(`Opponent increased their defense by ${defenseBoost}!`);
    } else if (aiAction === 'special' && opponentEnergy >= 2) {
      const specialDamage = calculateSpecialMoveDamage(opponentTeddy);
      playerHealth -= specialDamage;
      opponentEnergy -= 2;
      battleLog.push(`Opponent used their special move for ${specialDamage} damage!`);
    }

    return {
      player_health: playerHealth,
      opponent_health: opponentHealth,
      player_energy: playerEnergy,
      opponent_energy: opponentEnergy,
      next_turn: 'player',
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

  const handleAction = (action) => {
    if (battleState.currentTurn !== 'player') return;
    battleActionMutation.mutate({ action });
    captureEvent('Player_Action', { action });
  };

  const calculateAIAction = (aiTeddy, playerTeddy, energy) => {
    if (energy >= 2 && Math.random() > 0.7) return 'special';
    return Math.random() > 0.5 ? 'attack' : 'defend';
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
        playerEnergy={battleState.playerEnergy}
        opponentEnergy={battleState.opponentEnergy}
        currentTurn={battleState.currentTurn}
      />
      <ActionButtons
        onAction={handleAction}
        isPlayerTurn={battleState.currentTurn === 'player'}
        playerEnergy={battleState.playerEnergy}
        isLoading={battleActionMutation.isLoading}
      />
      <BattleLog log={battleState.battleLog} />
    </div>
  );
};

export default Battle;