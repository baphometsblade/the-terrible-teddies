import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleStatus from './BattleStatus';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import { motion } from 'framer-motion';
import { useBattleLogic } from '../../hooks/useBattleLogic';

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
    battleLog
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
      <BattleField battle={battle} animationState={animationState} battleEffect={battleEffect} />
      <PowerUpMeter powerUpMeter={powerUpMeter} onPowerUp={handlePowerUp} />
      <ActionButtons 
        onAction={handleAction} 
        isDisabled={battle.status === 'finished' || battle.current_turn !== battle.player1_id}
      />
      <BattleStatus battle={battle} />
      <BattleLog log={battleLog} />
    </motion.div>
  );
};

export default BattleArena;
