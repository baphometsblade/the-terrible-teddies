import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calculateDamage, applyPowerUp, checkForCombo } from '../utils/battleUtils';
import { checkAchievements } from '../utils/achievementSystem';
import { useToast } from "@/components/ui/use-toast";
import AIOpponent from '../utils/AIOpponent';

export const useBattleLogic = (playerTeddy, opponentTeddy) => {
  const [battleState, setBattleState] = useState({
    playerHealth: 100,
    opponentHealth: 100,
    playerDefenseBoost: 0,
    opponentDefenseBoost: 0,
    currentTurn: 'player',
    roundCount: 0
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

  const performAction = (action) => {
    let newBattleState = { ...battleState };
    let damage = 0;
    let logMessage = '';

    if (action === 'attack') {
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newBattleState.opponentDefenseBoost);
      newBattleState.opponentHealth -= damage;
      logMessage = `${playerTeddyData.name} attacks for ${damage} damage!`;
    } else if (action === 'special') {
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newBattleState.opponentDefenseBoost) * 1.5;
      newBattleState.opponentHealth -= damage;
      logMessage = `${playerTeddyData.name} uses ${playerTeddyData.special_move} for ${damage} damage!`;
    } else if (action === 'defend') {
      const defenseBoost = Math.floor(Math.random() * 10) + 5;
      newBattleState.playerDefenseBoost += defenseBoost;
      logMessage = `${playerTeddyData.name} increases defense by ${defenseBoost}!`;
    }

    setBattleLog(prev => [...prev, logMessage]);
    setMoveHistory(prev => [...prev, action]);
    setPowerUpMeter(prev => Math.min(prev + 10, 100));

    const combo = checkForCombo(moveHistory);
    if (combo) {
      setComboMeter(0);
      const comboMessage = `${playerTeddyData.name} activates ${combo.name} combo!`;
      setBattleLog(prev => [...prev, comboMessage]);
      // Apply combo effect
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
    let damage = 0;
    let logMessage = '';

    if (action === 'attack') {
      damage = calculateDamage(opponentTeddyData, playerTeddyData, newBattleState.playerDefenseBoost);
      newBattleState.playerHealth -= damage;
      logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!`;
    } else if (action === 'special') {
      damage = calculateDamage(opponentTeddyData, playerTeddyData, newBattleState.playerDefenseBoost) * 1.5;
      newBattleState.playerHealth -= damage;
      logMessage = `${opponentTeddyData.name} uses ${opponentTeddyData.special_move} for ${damage} damage!`;
    } else if (action === 'defend') {
      const defenseBoost = Math.floor(Math.random() * 10) + 5;
      newBattleState.opponentDefenseBoost += defenseBoost;
      logMessage = `${opponentTeddyData.name} increases defense by ${defenseBoost}!`;
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
      // Apply power-up effect
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