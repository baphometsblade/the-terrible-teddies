import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import BattleField from './BattleField';
import BattleActions from './BattleActions';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import WeatherEffect from './WeatherEffect';
import RandomEventDisplay from './RandomEventDisplay';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { motion, AnimatePresence } from 'framer-motion';
import BattleAnimation from './BattleAnimation';
import WeatherForecast from './WeatherForecast';

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
    randomEvents,
  } = useBattleLogic(playerTeddy, opponentTeddy);

  const [battleAnimation, setBattleAnimation] = useState(null);
  const [showRewards, setShowRewards] = useState(false);

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

    setShowRewards(true);
  };

  const handlePlayerAction = async (action) => {
    setBattleAnimation(action);
    const newState = await handleAction(action);
    setTimeout(() => setBattleAnimation(null), 1000);

    if (newState.opponentHealth <= 0) {
      handleBattleEnd('win');
      return;
    }

    // AI opponent's turn
    setTimeout(async () => {
      const aiActionResult = await aiAction();
      setBattleAnimation(aiActionResult.action);
      setTimeout(() => setBattleAnimation(null), 1000);

      if (aiActionResult.newState.playerHealth <= 0) {
        handleBattleEnd('lose');
      }
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
      <WeatherForecast currentWeather={battleState.weatherEffect} roundCount={battleState.roundCount} />
      <BattleField
        battleState={battleState}
        playerTeddyData={playerTeddyData}
        opponentTeddyData={opponentTeddyData}
      />
      <AnimatePresence>
        {battleAnimation && (
          <BattleAnimation
            action={battleAnimation}
            attacker={battleState.currentTurn === 'player' ? playerTeddyData : opponentTeddyData}
          />
        )}
      </AnimatePresence>
      <BattleActions
        currentTurn={battleState.currentTurn}
        playerEnergy={battleState.playerEnergy}
        onAction={handlePlayerAction}
        rage={battleState.rage}
      />
      <div className="flex justify-between mt-4">
        <PowerUpMeter value={battleState.powerUpMeter} onPowerUp={handlePowerUp} />
        <ComboMeter value={battleState.comboMeter} onCombo={handleCombo} />
      </div>
      <BattleLog battleLog={battleState.battleLog} />
      <RandomEventDisplay events={randomEvents} />
      {showRewards && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
        >
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Battle Rewards</h2>
            {/* Add reward details here */}
            <Button onClick={() => setShowRewards(false)}>Close</Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default BattleSystem;