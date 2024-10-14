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
import { generateRandomBattleEffect, applyBattleEffect } from '../../utils/battleEffects';
import { Button } from "@/components/ui/button";

const BattleArena = () => {
  const [battleId, setBattleId] = useState(null);
  const [isAIOpponent, setIsAIOpponent] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [battleLog, setBattleLog] = useState([]);
  const [animationState, setAnimationState] = useState('idle');
  const [battleEffect, setBattleEffect] = useState(null);
  const [powerUpMeter, setPowerUpMeter] = useState(0);
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
    // Increase power-up meter
    setPowerUpMeter(prev => Math.min(prev + 10, 100));
  };

  const handlePowerUp = () => {
    if (powerUpMeter === 100) {
      // Apply power-up effect
      const powerUpEffect = {
        name: "Ultimate Power-Up",
        description: "Your teddy's stats are doubled for this turn!",
        effect: (attacker) => {
          attacker.attack *= 2;
          attacker.defense *= 2;
        }
      };
      applyBattleEffect(powerUpEffect, battle.player1_teddy, battle.player2_teddy);
      setPowerUpMeter(0);
      toast({
        title: "Power-Up Activated!",
        description: powerUpEffect.description,
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
      <BattleField battle={battle} animationState={animationState} battleEffect={battleEffect} />
      <div className="mb-4">
        <h2 className="text-xl font-bold">Power-Up Meter</h2>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${powerUpMeter}%` }}></div>
        </div>
        <Button 
          onClick={handlePowerUp} 
          disabled={powerUpMeter < 100}
          className="mt-2"
        >
          Activate Power-Up
        </Button>
      </div>
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