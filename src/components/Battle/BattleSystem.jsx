import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import BattleField from './BattleField';
import BattleActions from './BattleActions';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import WeatherEffect from './WeatherEffect';
import AIOpponent from './AIOpponent';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { motion } from 'framer-motion';

const BattleSystem = ({ playerTeddy }) => {
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const { toast } = useToast();
  const {
    battleState,
    handleAction,
    handlePowerUp,
    handleCombo,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData,
    aiAction,
  } = useBattleLogic(playerTeddy, opponentTeddy);

  const [battleAnimation, setBattleAnimation] = useState(null);

  const { data: opponents, isLoading: isLoadingOpponents } = useQuery({
    queryKey: ['opponents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .neq('id', playerTeddy.id)
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!playerTeddy,
  });

  useEffect(() => {
    if (opponents && opponents.length > 0) {
      setOpponentTeddy(opponents[Math.floor(Math.random() * opponents.length)]);
    }
  }, [opponents]);

  const handleBattleEnd = async (result) => {
    toast({
      title: result === 'win' ? "Victory!" : "Defeat",
      description: result === 'win' ? "You won the battle!" : "You lost the battle.",
      variant: result === 'win' ? "success" : "destructive",
    });

    // Update player stats
    const { data: playerStats, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', playerTeddy.player_id)
      .single();

    if (!error) {
      await supabase
        .from('player_stats')
        .update({
          battles_fought: playerStats.battles_fought + 1,
          battles_won: result === 'win' ? playerStats.battles_won + 1 : playerStats.battles_won,
        })
        .eq('player_id', playerTeddy.player_id);
    }

    // Award XP to the player's teddy
    if (result === 'win') {
      await supabase
        .from('player_teddies')
        .update({ xp: playerTeddy.xp + 10 })
        .eq('id', playerTeddy.id);
    }
  };

  const handlePlayerAction = async (action) => {
    setBattleAnimation(action);
    await handleAction(action);
    setTimeout(() => setBattleAnimation(null), 1000);

    // AI opponent's turn
    setTimeout(async () => {
      const aiActionResult = await aiAction();
      setBattleAnimation(aiActionResult.action);
      setTimeout(() => setBattleAnimation(null), 1000);
    }, 1500);
  };

  if (isLoadingPlayerTeddy || isLoadingOpponentTeddy || isLoadingOpponents) {
    return <div>Loading battle data...</div>;
  }

  return (
    <motion.div 
      className="battle-system p-4 bg-gray-100 rounded-lg shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <WeatherEffect weather={battleState.weatherEffect} />
      <BattleField
        battleState={battleState}
        playerTeddyData={playerTeddyData}
        opponentTeddyData={opponentTeddyData}
        battleAnimation={battleAnimation}
      />
      <BattleActions
        currentTurn={battleState.currentTurn}
        playerEnergy={battleState.playerEnergy}
        onAction={handlePlayerAction}
      />
      <div className="flex justify-between mt-4">
        <PowerUpMeter value={battleState.powerUpMeter} onPowerUp={handlePowerUp} />
        <ComboMeter value={battleState.comboMeter} onCombo={handleCombo} />
      </div>
      <BattleLog battleLog={battleState.battleLog} />
      <Button 
        onClick={() => handleBattleEnd(battleState.playerHealth > 0 ? 'win' : 'lose')}
        className="mt-4"
      >
        End Battle
      </Button>
    </motion.div>
  );
};

export default BattleSystem;