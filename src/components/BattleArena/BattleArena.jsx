import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleStatus from './BattleStatus';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import { motion, AnimatePresence } from 'framer-motion';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import BattleRewards from './BattleRewards';

const BattleArena = () => {
  const [battleId, setBattleId] = useState(null);
  const { toast } = useToast();

  const {
    battle,
    isLoading,
    error,
    handleAction,
    handlePowerUp,
    animationState,
    battleEffect,
    powerUpMeter,
    battleLog,
    comboMeter,
    handleCombo
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
      <AnimatePresence>
        <motion.div
          key={battleEffect?.name}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="mb-4 p-2 bg-purple-100 rounded-lg"
        >
          <h2 className="text-xl font-semibold">{battleEffect?.name}</h2>
          <p>{battleEffect?.description}</p>
        </motion.div>
      </AnimatePresence>
      <BattleField battle={battle} animationState={animationState} battleEffect={battleEffect} />
      <PowerUpMeter powerUpMeter={powerUpMeter} onPowerUp={handlePowerUp} />
      <div className="mb-4">
        <h2 className="text-xl font-bold">Combo Meter</h2>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${comboMeter}%` }}></div>
        </div>
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
    </motion.div>
  );
};

export default BattleArena;