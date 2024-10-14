import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleStatus from './BattleStatus';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import { motion, AnimatePresence } from 'framer-motion';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import BattleRewards from './BattleRewards';
import AchievementPopup from './AchievementPopup';
import BattleEffects from './BattleEffects';
import TeddyTraits from './TeddyTraits';
import BattleTimer from './BattleTimer';
import { getRandomPowerUp, applyPowerUp } from '../../utils/powerUps';

const BattleArena = () => {
  const [battleId, setBattleId] = useState(null);
  const [showAchievement, setShowAchievement] = useState(false);
  const [activePowerUp, setActivePowerUp] = useState(null);
  const { toast } = useToast();

  const {
    battle,
    isLoading,
    error,
    handleAction,
    handlePowerUp,
    handleCombo,
    animationState,
    battleEffect,
    powerUpMeter,
    comboMeter,
    battleLog,
    achievements
  } = useBattleLogic(battleId);

  useEffect(() => {
    const createBattle = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: playerTeddy } = await supabase
        .from('player_teddies')
        .select('teddy_id')
        .eq('player_id', user.id)
        .limit(1)
        .single();

      if (!playerTeddy) return;

      const { data: battle, error } = await supabase
        .from('battles')
        .insert({
          player1_id: user.id,
          player2_id: null,
          player1_teddy_id: playerTeddy.teddy_id,
          player2_teddy_id: null,
          current_turn: user.id,
          is_ai_opponent: true,
          ai_difficulty: 'medium',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating battle:', error);
        return;
      }

      setBattleId(battle.id);
      
      // Set initial battle effect
      const initialEffect = generateRandomBattleEffect();
      setBattleEffect(initialEffect);
      toast({
        title: "Initial Battle Effect",
        description: initialEffect.description,
        variant: "info",
      });
    };
    createBattle();
  }, []);

  useEffect(() => {
    if (achievements.length > 0) {
      setShowAchievement(true);
      setTimeout(() => setShowAchievement(false), 3000);
    }
  }, [achievements]);

  const handleTimeUp = () => {
    // Auto-select a random action when time is up
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    handleAction(randomAction);
  };

  const activatePowerUp = () => {
    if (powerUpMeter >= 100) {
      const powerUp = getRandomPowerUp();
      setActivePowerUp(powerUp);
      applyPowerUp(battle.player1_teddy, powerUp);
      toast({
        title: "Power-Up Activated!",
        description: `${powerUp.name}: ${powerUp.description}`,
        variant: "success",
      });
    }
  };

  if (isLoading) return <div>Loading battle...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!battle) return <div>No active battle</div>;

  return (
    <motion.div 
      className="container mx-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-3xl font-bold mb-4">Battle Arena</h1>
      <div className="flex justify-between items-center mb-4">
        <BattleTimer duration={30} onTimeUp={handleTimeUp} />
        <BattleEffects effect={battleEffect} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <BattleField battle={battle} animationState={animationState} battleEffect={battleEffect} />
        <TeddyTraits teddy={battle.player1_teddy} />
      </div>
      <div className="flex justify-between mb-4">
        <PowerUpMeter powerUpMeter={powerUpMeter} onPowerUp={activatePowerUp} />
        <ComboMeter comboMeter={comboMeter} onCombo={handleCombo} />
      </div>
      <ActionButtons 
        onAction={handleAction}
        onCombo={handleCombo}
        isDisabled={battle.status === 'finished' || battle.current_turn !== battle.player1_id}
        comboReady={comboMeter === 100}
      />
      <BattleStatus battle={battle} />
      <BattleLog log={battleLog} />
      {battle.status === 'finished' && <BattleRewards battle={battle} />}
      <AnimatePresence>
        {showAchievement && (
          <AchievementPopup achievement={achievements[achievements.length - 1]} />
        )}
        {activePowerUp && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 bg-green-100 p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-lg font-bold">{activePowerUp.name}</h3>
            <p>{activePowerUp.description}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BattleArena;