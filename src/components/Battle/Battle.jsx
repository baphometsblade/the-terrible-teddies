import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from '../TeddyCard';
import BattleLog from './BattleLog';
import { calculateDamage } from '../../utils/battleUtils';
import { captureEvent } from '../../utils/posthog';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);
  const { toast } = useToast();

  const addToBattleLog = (message) => {
    setBattleLog(prevLog => [...prevLog, message]);
  };

  const battleActionMutation = useMutation({
    mutationFn: async ({ action }) => {
      const { data, error } = await supabase.rpc('battle_action', {
        player_teddy_id: playerTeddy.id,
        opponent_teddy_id: opponentTeddy.id,
        action: action,
        player_health: playerHealth,
        opponent_health: opponentHealth,
        player_energy: playerEnergy,
        opponent_energy: opponentEnergy
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPlayerHealth(data.player_health);
      setOpponentHealth(data.opponent_health);
      setPlayerEnergy(data.player_energy);
      setOpponentEnergy(data.opponent_energy);
      setCurrentTurn(data.next_turn);
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
    if (playerHealth <= 0 || opponentHealth <= 0) {
      onBattleEnd(playerHealth > opponentHealth ? 'win' : 'lose');
    }
  }, [playerHealth, opponentHealth]);

  const handleAction = (action) => {
    if (currentTurn !== 'player') return;
    battleActionMutation.mutate({ action });
  };

  useEffect(() => {
    if (currentTurn === 'opponent') {
      setTimeout(() => {
        const aiAction = calculateAIAction(opponentTeddy, playerTeddy, opponentEnergy);
        battleActionMutation.mutate({ action: aiAction });
      }, 1000);
    }
  }, [currentTurn]);

  return (
    <div className="battle-arena p-4 bg-gray-100 rounded-lg">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-xl font-bold mb-2">Your Teddy</h3>
          <TeddyCard teddy={playerTeddy} />
          <p>Health: {playerHealth}/30</p>
          <p>Energy: {playerEnergy}/3</p>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Opponent's Teddy</h3>
          <TeddyCard teddy={opponentTeddy} />
          <p>Health: {opponentHealth}/30</p>
          <p>Energy: {opponentEnergy}/3</p>
        </div>
      </div>
      <div className="action-buttons mb-4">
        <Button onClick={() => handleAction('attack')} disabled={currentTurn !== 'player' || battleActionMutation.isLoading}>Attack</Button>
        <Button onClick={() => handleAction('defend')} disabled={currentTurn !== 'player' || battleActionMutation.isLoading}>Defend</Button>
        <Button onClick={() => handleAction('special')} disabled={currentTurn !== 'player' || playerEnergy < 2 || battleActionMutation.isLoading}>Special Move</Button>
      </div>
      <BattleLog log={battleLog} />
    </div>
  );
};

export default Battle;