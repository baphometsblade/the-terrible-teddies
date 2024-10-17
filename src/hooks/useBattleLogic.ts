import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { checkForCombo, applyCombo } from '../utils/comboSystem';
import { generatePowerUps, applyPowerUp } from '../utils/powerUpSystem';
import { getAIAction, performAIAction } from '../utils/AIOpponent';
import { applyWeatherEffect, getRandomWeather } from '../utils/weatherEffects';
import { applyBattleResults } from '../utils/levelSystem';
import { BattleState, TeddyCard, PowerUp } from '../types/types';
import { calculateCriticalHit } from '../utils/criticalHits';
import { applyStatusEffects, addStatusEffect } from '../utils/statusEffects';
import { checkAchievements, Achievement } from '../utils/achievementSystem';

export const useBattleLogic = () => {
  const [battleState, setBattleState] = useState<BattleState>({
    playerHealth: 100,
    opponentHealth: 100,
    playerEnergy: 3,
    opponentEnergy: 3,
    currentTurn: 'player',
    roundCount: 0,
    battleLog: [],
    moveHistory: [],
    powerUpMeter: 0,
    comboMeter: 0,
    playerStatusEffects: [],
    opponentStatusEffects: [],
    playerDefenseBoost: 0,
    opponentDefenseBoost: 0,
    playerStunned: false,
    opponentStunned: false,
  });

  const [weatherEffect, setWeatherEffect] = useState(getRandomWeather());
  const [powerUps, setPowerUps] = useState<PowerUp[]>(generatePowerUps());
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);

  const { data: playerTeddyData, isLoading: isLoadingPlayerTeddy } = useQuery({
    queryKey: ['playerTeddy', battleState.playerTeddyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', battleState.playerTeddyId)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
    enabled: !!battleState.playerTeddyId,
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponentTeddy } = useQuery({
    queryKey: ['opponentTeddy', battleState.opponentTeddyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', battleState.opponentTeddyId)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
    enabled: !!battleState.opponentTeddyId,
  });

  useEffect(() => {
    if (battleState.roundCount % 3 === 0) {
      setWeatherEffect(getRandomWeather());
    }
  }, [battleState.roundCount]);

  const handleAction = async (action: string) => {
    if (!playerTeddyData || !opponentTeddyData) return;

    let newState = { ...battleState };
    newState.moveHistory.push(action);

    if (newState.playerStunned) {
      newState.battleLog.push(`${playerTeddyData.name} is stunned and loses their turn!`);
      newState.playerStunned = false;
    } else {
      switch (action) {
        case 'attack':
          const { isCritical, damage } = calculateCriticalHit(playerTeddyData, playerTeddyData.attack);
          const weatherAdjustedDamage = applyWeatherEffect('attack', damage, weatherEffect);
          newState.opponentHealth = Math.max(0, newState.opponentHealth - weatherAdjustedDamage);
          newState.battleLog.push(`${playerTeddyData.name} attacks for ${weatherAdjustedDamage} damage!${isCritical ? ' Critical hit!' : ''}`);
          if (Math.random() < 0.2) {
            newState = addStatusEffect(newState, 'burn', 'opponent');
          }
          break;
        case 'defend':
          newState.playerEnergy = Math.min(5, newState.playerEnergy + 1);
          newState.playerDefenseBoost = (newState.playerDefenseBoost || 0) + 2;
          newState.battleLog.push(`${playerTeddyData.name} defends, gaining 1 energy and boosting defense by 2.`);
          break;
        case 'special':
          if (newState.playerEnergy >= 2) {
            const specialDamage = playerTeddyData.attack * 1.5;
            newState.opponentHealth = Math.max(0, newState.opponentHealth - specialDamage);
            newState.playerEnergy -= 2;
            newState.battleLog.push(`${playerTeddyData.name} uses a special move for ${specialDamage} damage!`);
            newState = addStatusEffect(newState, 'stun', 'opponent');
          }
          break;
      }
    }

    const combo = checkForCombo(newState.moveHistory);
    if (combo) {
      newState = applyCombo(combo, newState, playerTeddyData);
      newState.comboMeter = 0;
    } else {
      newState.comboMeter = Math.min(100, newState.comboMeter + 20);
    }

    newState.powerUpMeter = Math.min(100, newState.powerUpMeter + 10);
    newState.playerEnergy = Math.min(5, newState.playerEnergy + 1); // Energy regeneration
    newState.currentTurn = 'opponent';
    newState.roundCount++;

    newState = applyStatusEffects(newState);

    const newUnlockedAchievements = checkAchievements(newState, unlockedAchievements);
    if (newUnlockedAchievements.length > unlockedAchievements.length) {
      setUnlockedAchievements(newUnlockedAchievements);
      const newAchievements = newUnlockedAchievements.filter((id) => !unlockedAchievements.includes(id));
      newAchievements.forEach((id) => {
        const achievement = achievements.find((a) => a.id === id);
        if (achievement) {
          newState.battleLog.push(`Achievement unlocked: ${achievement.name} - ${achievement.description}`);
        }
      });
    }

    setBattleState(newState);
    setTimeout(aiAction, 1000);
  };

  const handlePowerUp = () => {
    if (battleState.powerUpMeter === 100) {
      updateBattleState({
        ...battleState,
        playerEnergy: battleState.playerEnergy + 2,
        powerUpMeter: 0,
        battleLog: [...battleState.battleLog, `${playerTeddyData.name} uses Power Up and gains 2 energy!`],
      });
    }
  };

  const handleCombo = () => {
    if (battleState.comboMeter === 100) {
      const comboDamage = playerTeddyData.attack * 2;
      updateBattleState({
        ...battleState,
        opponentHealth: Math.max(0, battleState.opponentHealth - comboDamage),
        comboMeter: 0,
        battleLog: [...battleState.battleLog, `${playerTeddyData.name} unleashes a devastating combo attack for ${comboDamage} damage!`],
      });
    }
  };

  const aiAction = () => {
    if (!opponentTeddyData || !playerTeddyData) return;

    const action = getAIAction(opponentTeddyData, playerTeddyData, battleState);
    const newState = performAIAction(action, battleState, opponentTeddyData, playerTeddyData);

    setBattleState(newState);
  };

  const endBattle = () => {
    if (!playerTeddyData || !opponentTeddyData) return;

    const winner = battleState.playerHealth > 0 ? playerTeddyData : opponentTeddyData;
    const loser = battleState.playerHealth > 0 ? opponentTeddyData : playerTeddyData;
    const updatedWinner = applyBattleResults(winner, loser);

    // Here you would update the winner's data in the database
    console.log('Battle ended. Updated winner:', updatedWinner);
  };

  return {
    battleState,
    handleAction,
    handlePowerUp,
    handleCombo,
    aiAction,
    endBattle,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData,
    weatherEffect,
    unlockedAchievements,
  };
};
