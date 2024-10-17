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
import { getRandomBattleItem, BattleItem } from '../utils/battleItems';

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
    playerRage: 0,
    opponentRage: 0,
    playerItems: [getRandomBattleItem(), getRandomBattleItem()],
    opponentItems: [getRandomBattleItem()],
    weatherEffect: getRandomWeather(),
    playerAttackBoost: 0,
    opponentAttackBoost: 0,
    playerEnergyRegen: 0,
    opponentEnergyRegen: 0,
  });

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
    if (battleState.roundCount % 5 === 0 && battleState.roundCount > 0) {
      const newWeather = getRandomWeather();
      setBattleState((prevState) => applyWeatherEffect(prevState, newWeather));
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
          const { isCritical, damage } = calculateCriticalHit(playerTeddyData, playerTeddyData.attack + newState.playerAttackBoost);
          const weatherAdjustedDamage = damage * (1 + newState.weatherEffect.attackModifier);
          newState.opponentHealth = Math.max(0, newState.opponentHealth - weatherAdjustedDamage);
          newState.battleLog.push(`${playerTeddyData.name} attacks for ${weatherAdjustedDamage} damage!${isCritical ? ' Critical hit!' : ''}`);
          if (Math.random() < 0.2) {
            newState = addStatusEffect(newState, 'burn', 'opponent');
          }
          newState.playerRage = Math.min(100, newState.playerRage + 10);
          break;
        case 'defend':
          newState.playerEnergy = Math.min(5, newState.playerEnergy + 1 + newState.playerEnergyRegen);
          newState.playerDefenseBoost = (newState.playerDefenseBoost || 0) + 2;
          newState.battleLog.push(`${playerTeddyData.name} defends, gaining ${1 + newState.playerEnergyRegen} energy and boosting defense by 2.`);
          newState.playerRage = Math.min(100, newState.playerRage + 5);
          break;
        case 'special':
          if (newState.playerEnergy >= 2) {
            const specialDamage = (playerTeddyData.attack + newState.playerAttackBoost) * 1.5;
            newState.opponentHealth = Math.max(0, newState.opponentHealth - specialDamage);
            newState.playerEnergy -= 2;
            newState.battleLog.push(`${playerTeddyData.name} uses a special move for ${specialDamage} damage!`);
            newState = addStatusEffect(newState, 'stun', 'opponent');
            newState.playerRage = Math.min(100, newState.playerRage + 15);
          }
          break;
        case 'ultimate':
          if (newState.playerRage === 100) {
            const ultimateDamage = (playerTeddyData.attack + newState.playerAttackBoost) * 3;
            newState.opponentHealth = Math.max(0, newState.opponentHealth - ultimateDamage);
            newState.battleLog.push(`${playerTeddyData.name} unleashes their ultimate move for ${ultimateDamage} devastating damage!`);
            newState.playerRage = 0;
          }
          break;
        default:
          if (action.startsWith('use_item_')) {
            const itemIndex = parseInt(action.split('_')[2]);
            const item = newState.playerItems[itemIndex];
            newState = item.effect(newState, true);
            newState.playerItems = newState.playerItems.filter((_, index) => index !== itemIndex);
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
    newState.playerEnergy = Math.min(5, newState.playerEnergy + 1 + newState.playerEnergyRegen);
    newState.currentTurn = 'opponent';
    newState.roundCount++;

    newState = applyStatusEffects(newState);
    newState = applyWeatherEffect(newState, newState.weatherEffect);

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

  const aiAction = async () => {
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
    weatherEffect: battleState.weatherEffect,
    unlockedAchievements,
  };
};
