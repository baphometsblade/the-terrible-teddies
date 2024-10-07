import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import BattleLog from './BattleLog';
import PlayerHand from './PlayerHand';
import ActionButtons from './ActionButtons';
import { simulateAIAction, drawCard } from '../../utils/battleUtils';
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
    setPlayerHand(drawCard(3));
    setOpponentHand(drawCard(3));
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
        playerHealth: data.playerHealth,
        opponentHealth: data.opponentHealth,
        playerStuffing: data.playerStuffing,
        opponentStuffing: data.opponentStuffing,
        playerDefenseBoost: data.playerDefenseBoost,
        opponentDefenseBoost: data.opponentDefenseBoost,
        currentTurn: data.currentTurn,
        roundCount: data.roundCount,
      }));
      setPlayerHand(data.updatedPlayerHand);
      setOpponentHand(data.updatedOpponentHand);
      addToBattleLog(data.battleLog);

      // Draw a new card at the end of each round
      if (data.currentTurn === 'player') {
        setPlayerHand(prev => [...prev, ...drawCard(1)]);
      } else {
        setOpponentHand(prev => [...prev, ...drawCard(1)]);
      }
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
      <ActionButtons
        onAction={handleAction}
        isDisabled={battleState.currentTurn !== 'player'}
        playerStuffing={battleState.playerStuffing}
      />
      <BattleLog log={battleState.battleLog} />
    </div>
  );
};

export default Battle;