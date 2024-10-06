import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from '../TeddyCard';
import BattleLog from './BattleLog';
import { calculateDamage } from '../../utils/battleUtils';
import { captureEvent } from '../../utils/posthog';
import { motion } from 'framer-motion';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [battleState, setBattleState] = useState({
    playerHealth: 30,
    opponentHealth: 30,
    playerEnergy: 3,
    opponentEnergy: 3,
    currentTurn: 'player',
    battleLog: [],
  });

  const { toast } = useToast();

  const addToBattleLog = (message) => {
    setBattleState(prev => ({
      ...prev,
      battleLog: [...prev.battleLog, message],
    }));
  };

  const battleActionMutation = useMutation({
    mutationFn: async ({ action }) => {
      const { data, error } = await supabase.rpc('battle_action', {
        player_teddy_id: playerTeddy.id,
        opponent_teddy_id: opponentTeddy.id,
        action: action,
        ...battleState,
      });
      if (error) throw error;
      return data;
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

  useEffect(() => {
    if (battleState.currentTurn === 'opponent') {
      setTimeout(() => {
        const aiAction = calculateAIAction(opponentTeddy, playerTeddy, battleState.opponentEnergy);
        battleActionMutation.mutate({ action: aiAction });
        captureEvent('AI_Action', { action: aiAction });
      }, 1000);
    }
  }, [battleState.currentTurn]);

  const calculateAIAction = (aiTeddy, playerTeddy, energy) => {
    // Simple AI logic
    if (energy >= 2 && Math.random() > 0.7) return 'special';
    return Math.random() > 0.5 ? 'attack' : 'defend';
  };

  return (
    <div className="battle-arena p-4 bg-gray-100 rounded-lg">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <BattleParticipant
          teddy={playerTeddy}
          health={battleState.playerHealth}
          energy={battleState.playerEnergy}
          isPlayer={true}
        />
        <BattleParticipant
          teddy={opponentTeddy}
          health={battleState.opponentHealth}
          energy={battleState.opponentEnergy}
          isPlayer={false}
        />
      </div>
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

const BattleParticipant = ({ teddy, health, energy, isPlayer }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <h3 className="text-xl font-bold mb-2">{isPlayer ? 'Your Teddy' : "Opponent's Teddy"}</h3>
    <TeddyCard teddy={teddy} />
    <p>Health: {health}/30</p>
    <p>Energy: {energy}/3</p>
  </motion.div>
);

const ActionButtons = ({ onAction, isPlayerTurn, playerEnergy, isLoading }) => (
  <div className="action-buttons mb-4">
    <Button onClick={() => onAction('attack')} disabled={!isPlayerTurn || isLoading}>Attack</Button>
    <Button onClick={() => onAction('defend')} disabled={!isPlayerTurn || isLoading}>Defend</Button>
    <Button onClick={() => onAction('special')} disabled={!isPlayerTurn || playerEnergy < 2 || isLoading}>Special Move</Button>
  </div>
);

export default Battle;