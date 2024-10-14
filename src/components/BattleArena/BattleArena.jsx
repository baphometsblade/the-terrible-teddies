import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleStatus from './BattleStatus';
import BattleLog from './BattleLog';
import AIOpponent from '../../utils/AIOpponent';
import { motion, AnimatePresence } from 'framer-motion';
import { generateRandomBattleEffect } from '../../utils/battleEffects';

const BattleArena = () => {
  const [battleId, setBattleId] = useState(null);
  const [isAIOpponent, setIsAIOpponent] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [battleLog, setBattleLog] = useState([]);
  const [animationState, setAnimationState] = useState('idle');
  const [battleEffect, setBattleEffect] = useState(null);
  const { toast } = useToast();

  const { data: battle, isLoading, error, refetch } = useQuery({
    queryKey: ['battle', battleId],
    queryFn: async () => {
      if (!battleId) return null;
      const { data, error } = await supabase
        .from('battles')
        .select('*, player1:player1_id(*), player2:player2_id(*), player1_teddy:player1_teddy_id(*), player2_teddy:player2_teddy_id(*)')
        .eq('id', battleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!battleId,
  });

  const battleActionMutation = useMutation({
    mutationFn: async ({ action }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/battle-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          battleId,
          action,
          playerId: user.id,
          battleEffect: battleEffect,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }
      return response.json();
    },
    onSuccess: (data) => {
      refetch();
      setBattleLog(prevLog => [...prevLog, data.actionResult]);
      setAnimationState('attack');
      setTimeout(() => setAnimationState('idle'), 1000);
      
      // Generate a new random battle effect after each action
      const newEffect = generateRandomBattleEffect();
      setBattleEffect(newEffect);
      toast({
        title: "Battle Effect",
        description: newEffect.description,
        variant: "info",
      });
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
          player2_id: isAIOpponent ? null : user.id,
          player1_teddy_id: playerTeddy.teddy_id,
          player2_teddy_id: isAIOpponent ? AIOpponent.generateTeddy().id : playerTeddy.teddy_id,
          current_turn: user.id,
          is_ai_opponent: isAIOpponent,
          ai_difficulty: isAIOpponent ? aiDifficulty : null,
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
  }, [isAIOpponent, aiDifficulty]);

  const handleAction = (action) => {
    battleActionMutation.mutate({ action });
    if (isAIOpponent) {
      setTimeout(() => {
        const aiAction = AIOpponent.chooseAction(battle.player2_teddy, battle.player1_teddy, aiDifficulty);
        battleActionMutation.mutate({ action: aiAction });
      }, 1000);
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
      <BattleField battle={battle} animationState={animationState} battleEffect={battleEffect} />
      <ActionButtons 
        onAction={handleAction} 
        isDisabled={battleActionMutation.isLoading || battle.status === 'finished' || battle.current_turn !== battle.player1_id}
      />
      <BattleStatus battle={battle} />
      <BattleLog log={battleLog} />
    </motion.div>
  );
};

export default BattleArena;