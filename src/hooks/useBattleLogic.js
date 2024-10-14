import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { generateRandomBattleEffect, applyBattleEffect } from '../utils/battleEffects';
import AIOpponent from '../utils/AIOpponent';
import { checkForCombo, applyComboEffect } from '../utils/comboSystem';
import { checkAchievements } from '../utils/achievementSystem';
import { getRandomPowerUp, applyPowerUp } from '../utils/powerUps';
import { useSpecialAbility } from '../utils/specialAbilities';

export const useBattleLogic = (battleId) => {
  const [animationState, setAnimationState] = useState('idle');
  const [battleEffect, setBattleEffect] = useState(null);
  const [powerUpMeter, setPowerUpMeter] = useState(0);
  const [comboMeter, setComboMeter] = useState(0);
  const [battleLog, setBattleLog] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);

  const [achievements, setAchievements] = useState([]);

  const [activePowerUps, setActivePowerUps] = useState([]);


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
      
      const newEffect = generateRandomBattleEffect();
      setBattleEffect(newEffect);
      toast({
        title: "Battle Effect",
        description: newEffect.description,
        variant: "info",
      });

      setMoveHistory(prev => [...prev, data.action]);
      const combo = checkForCombo(moveHistory);
      if (combo) {
        applyComboEffect(combo, battle.player1_teddy, battle.player2_teddy);
        setBattleLog(prevLog => [...prevLog, `Combo activated: ${combo.name}`]);
        setComboMeter(0);
      } else {
        setComboMeter(prev => Math.min(prev + 20, 100));
      }

      // Check for achievements after each action
      const newAchievements = checkAchievements(battle, data.action);
      if (newAchievements.length > 0) {
        setAchievements(prev => [...prev, ...newAchievements]);
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

  const handleAction = (action) => {
    battleActionMutation.mutate({ action });
    if (battle.is_ai_opponent) {
      setTimeout(() => {
        const aiAction = AIOpponent.chooseAction(battle.player2_teddy, battle.player1_teddy, battle.ai_difficulty);
        battleActionMutation.mutate({ action: aiAction });
      }, 1000);
    }
    setPowerUpMeter(prev => Math.min(prev + 10, 100));
    
    // Apply active power-ups
    activePowerUps.forEach(powerUp => {
      applyPowerUp(battle.player1_teddy, powerUp);
    });
    
    // Decrease power-up durations and remove expired ones
    setActivePowerUps(prev => 
      prev.map(p => ({ ...p, duration: p.duration - 1 }))
         .filter(p => p.duration > 0)
    );

    setMoveHistory(prev => [...prev, action]);
    const combo = checkForCombo(moveHistory);
    if (combo) {
      const comboResult = applyComboEffect(combo, battle.player1_teddy, battle.player2_teddy);
      setBattleLog(prevLog => [...prevLog, comboResult]);
      setComboMeter(0);
    } else {
      setComboMeter(prev => Math.min(prev + 20, 100));
    }

    if (action === 'special') {
      const specialAbilityResult = useSpecialAbility(battle.player1_teddy, battle.player2_teddy, battle);
      setBattleLog(prevLog => [...prevLog, specialAbilityResult]);
    }

    // Check for achievements after each action
    const newAchievements = checkAchievements(battle, action);
    if (newAchievements.length > 0) {
      setAchievements(prev => [...prev, ...newAchievements]);
    }
  };

  const handlePowerUp = () => {
    if (powerUpMeter === 100) {
      const newPowerUp = getRandomPowerUp();
      setActivePowerUps(prev => [...prev, newPowerUp]);
      applyPowerUp(battle.player1_teddy, newPowerUp);
      setPowerUpMeter(0);
      toast({
        title: "Power-Up Activated!",
        description: `${newPowerUp.name}: ${newPowerUp.description}`,
        variant: "success",
      });
    }
  };

  const handleCombo = () => {
    if (comboMeter === 100) {
      const combo = checkForCombo(moveHistory);
      if (combo) {
        const comboResult = applyComboEffect(combo, battle.player1_teddy, battle.player2_teddy);
        setBattleLog(prevLog => [...prevLog, comboResult]);
        setComboMeter(0);
      }
    }
  };

  return {
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
    achievements,
    activePowerUps
  };
};