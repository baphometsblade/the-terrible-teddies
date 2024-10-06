import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import BattleLog from './BattleLog';
import PlayerHand from './PlayerHand';
import { simulateAIAction } from '../../utils/battleUtils';
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
        return simulateAIAction(battleState, playerTeddy, opponentTeddy, playerHand, opponentHand, action, cardId);
      } else {
        // ... keep existing code for non-AI opponent
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
        battleState={battleState}
      />
      <PlayerHand
        hand={playerHand}
        onPlayCard={handleAction}
        isPlayerTurn={battleState.currentTurn === 'player'}
        playerStuffing={battleState.playerStuffing}
      />
      <BattleLog log={battleState.battleLog} />
    </div>
  );
};

export default Battle;
