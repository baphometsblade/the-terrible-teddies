import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calculateDamage, applyPowerUp, checkForCombo, applyComboEffect, applyStatusEffect, rollForCritical } from '../utils/battleUtils';
import { checkAchievements } from '../utils/achievementSystem';
import { useToast } from "@/components/ui/use-toast";
import AIOpponent from '../utils/AIOpponent';

export const useBattleLogic = (playerTeddy, opponentTeddy) => {
  const [battleState, setBattleState] = useState({
    playerHealth: 100,
    opponentHealth: 100,
    playerDefenseBoost: 0,
    opponentDefenseBoost: 0,
    playerStatusEffect: null,
    opponentStatusEffect: null,
    currentTurn: 'player',
    roundCount: 0,
    playerExperience: 0,
    playerLevel: 1,
  });
  const [battleLog, setBattleLog] = useState([]);
  const [powerUpMeter, setPowerUpMeter] = useState(0);
  const [comboMeter, setComboMeter] = useState(0);
  const [moveHistory, setMoveHistory] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const { toast } = useToast();

  const { data: playerTeddyData, isLoading: isLoadingPlayer, error: playerError } = useQuery({
    queryKey: ['teddy', playerTeddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', playerTeddy.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponent, error: opponentError } = useQuery({
    queryKey: ['teddy', opponentTeddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', opponentTeddy.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updatePlayerTeddyMutation = useMutation({
    mutationFn: async (updatedTeddy) => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .update(updatedTeddy)
        .eq('id', playerTeddy.id);
      if (error) throw error;
      return data;
    },
  });

  const performAction = (action) => {
    let newBattleState = { ...battleState };
    let damage = 0;
    let logMessage = '';

    const isCritical = rollForCritical(playerTeddyData);

    if (action === 'attack') {
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newBattleState.opponentDefenseBoost, isCritical);
      newBattleState.opponentHealth -= damage;
      logMessage = `${playerTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
    } else if (action === 'special') {
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newBattleState.opponentDefenseBoost) * 1.5;
      newBattleState.opponentHealth -= damage;
      newBattleState.opponentStatusEffect = 'elemental';
      logMessage = `${playerTeddyData.name} uses ${playerTeddyData.special_move} for ${damage} damage and applies elemental effect!`;
    } else if (action === 'defend') {
      const defenseBoost = Math.floor(playerTeddyData.defense * 0.5);
      newBattleState.playerDefenseBoost += defenseBoost;
      logMessage = `${playerTeddyData.name} increases defense by ${defenseBoost}!`;
    }

    setBattleLog(prev => [...prev, logMessage]);
    setMoveHistory(prev => [...prev, action]);
    setPowerUpMeter(prev => Math.min(prev + 10, 100));

    const combo = checkForCombo(moveHistory);
    if (combo) {
      setComboMeter(0);
      const comboEffect = applyComboEffect(combo, playerTeddyData, opponentTeddyData);
      const comboMessage = `${playerTeddyData.name} activates ${combo.name} combo!`;
      setBattleLog(prev => [...prev, comboMessage]);
      if (comboEffect.damage) {
        newBattleState.opponentHealth -= comboEffect.damage;
      }
      if (comboEffect.defenseBoost) {
        newBattleState.playerDefenseBoost += comboEffect.defenseBoost;
      }
      if (comboEffect.statusEffect) {
        newBattleState.opponentStatusEffect = comboEffect.statusEffect;
      }
    } else {
      setComboMeter(prev => Math.min(prev + 20, 100));
    }

    const newAchievements = checkAchievements(action, damage, newBattleState.playerHealth, newBattleState.opponentHealth);
    if (newAchievements.length > 0) {
      setAchievements(prev => [...prev, ...newAchievements]);
      newAchievements.forEach(achievement => {
        toast({
          title: "Achievement Unlocked!",
          description: achievement.name,
        });
      });
    }

    // Apply status effects
    if (newBattleState.playerStatusEffect) {
      const updatedPlayerTeddy = applyStatusEffect(playerTeddyData, newBattleState.playerStatusEffect);
      newBattleState.playerHealth = updatedPlayerTeddy.health;
      setBattleLog(prev => [...prev, `${playerTeddyData.name} is affected by ${newBattleState.playerStatusEffect}!`]);
    }
    if (newBattleState.opponentStatusEffect) {
      const updatedOpponentTeddy = applyStatusEffect(opponentTeddyData, newBattleState.opponentStatusEffect);
      newBattleState.opponentHealth = updatedOpponentTeddy.health;
      setBattleLog(prev => [...prev, `${opponentTeddyData.name} is affected by ${newBattleState.opponentStatusEffect}!`]);
    }

    // Gain experience
    newBattleState.playerExperience += Math.floor(damage / 2);
    
    // Check for level up
    if (newBattleState.playerExperience >= newBattleState.playerLevel * 100) {
      newBattleState.playerLevel++;
      newBattleState.playerExperience -= (newBattleState.playerLevel - 1) * 100;
      toast({
        title: "Level Up!",
        description: `${playerTeddyData.name} has reached level ${newBattleState.playerLevel}!`,
      });
      
      // Update player teddy stats
      const updatedTeddy = {
        ...playerTeddyData,
        attack: playerTeddyData.attack + 1,
        defense: playerTeddyData.defense + 1,
      };
      updatePlayerTeddyMutation.mutate(updatedTeddy);
    }

    newBattleState.currentTurn = 'opponent';
    newBattleState.roundCount++;
    setBattleState(newBattleState);

    // AI opponent turn
    setTimeout(() => {
      const aiAction = AIOpponent.chooseAction(opponentTeddyData, playerTeddyData, newBattleState);
      performAIAction(aiAction);
    }, 1500);
  };

  const performAIAction = (action) => {
    let newBattleState = { ...battleState };
    const aiActionResult = AIOpponent.performAction(action, opponentTeddyData, playerTeddyData, newBattleState);

    newBattleState.playerHealth -= aiActionResult.damage;
    newBattleState.opponentDefenseBoost += aiActionResult.defenseBoost;
    if (aiActionResult.statusEffect) {
      newBattleState.playerStatusEffect = aiActionResult.statusEffect;
    }

    let logMessage = '';
    if (action === 'attack') {
      logMessage = `${opponentTeddyData.name} attacks for ${aiActionResult.damage} damage!`;
    } else if (action === 'special') {
      logMessage = `${opponentTeddyData.name} uses ${opponentTeddyData.special_move} for ${aiActionResult.damage} damage!`;
    } else if (action === 'defend') {
      logMessage = `${opponentTeddyData.name} increases defense by ${aiActionResult.defenseBoost}!`;
    }

    setBattleLog(prev => [...prev, logMessage]);
    newBattleState.currentTurn = 'player';
    setBattleState(newBattleState);
  };

  const handlePowerUp = () => {
    if (powerUpMeter === 100) {
      const powerUp = applyPowerUp(playerTeddyData);
      setBattleLog(prev => [...prev, `${playerTeddyData.name} activates ${powerUp.name}!`]);
      setPowerUpMeter(0);
      // Apply power-up effect to playerTeddyData
    }
  };

  const handleCombo = () => {
    if (comboMeter === 100) {
      const combo = checkForCombo(moveHistory);
      if (combo) {
        setBattleLog(prev => [...prev, `${playerTeddyData.name} unleashes ${combo.name} combo!`]);
        setComboMeter(0);
        // Apply combo effect
      }
    }
  };

  return {
    battleState,
    performAction,
    handlePowerUp,
    handleCombo,
    battleLog,
    powerUpMeter,
    comboMeter,
    currentTurn: battleState.currentTurn,
    isLoading: isLoadingPlayer || isLoadingOpponent,
    error: playerError || opponentError
  };
};