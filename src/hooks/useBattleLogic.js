import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calculateDamage, applyStatusEffect, rollForCritical } from '../utils/battleUtils';
import { checkForCombo, applyComboEffect } from '../utils/comboSystem';
import { getSpecialAbility, useSpecialAbility } from '../utils/specialAbilities';
import { applyBattleEvent } from '../utils/battleEvents';
import { getWeatherEffect } from '../utils/weatherEffects';

export const useBattleLogic = (playerTeddy, opponentTeddy) => {
  const [battleState, setBattleState] = useState({
    playerHealth: 100,
    opponentHealth: 100,
    playerEnergy: 3,
    opponentEnergy: 3,
    currentTurn: 'player',
    battleLog: [],
    comboMeter: 0,
    powerUpMeter: 0,
    weatherEffect: null,
    playerStatusEffect: null,
    opponentStatusEffect: null,
    roundCount: 0,
    moveHistory: [],
  });

  const { data: playerTeddyData, isLoading: isLoadingPlayerTeddy } = useQuery({
    queryKey: ['playerTeddy', playerTeddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', playerTeddy.id)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponentTeddy } = useQuery({
    queryKey: ['opponentTeddy', opponentTeddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', opponentTeddy.id)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
  });

  const updateBattleMutation = useMutation({
    mutationFn: async (newBattleState) => {
      const { data, error } = await supabase
        .from('battles')
        .update(newBattleState)
        .eq('id', battleState.id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Refetch battle data after successful update
      queryClient.invalidateQueries(['battle', battleState.id]);
    },
  });

  const handleAction = (action) => {
    let newBattleState = { ...battleState };
    let damage = 0;
    let energyCost = 1;
    let logMessage = '';

    const isCritical = rollForCritical(playerTeddyData);

    switch (action) {
      case 'attack':
        damage = calculateDamage(playerTeddyData, opponentTeddyData, newBattleState.opponentStatusEffect, isCritical);
        newBattleState.opponentHealth -= damage;
        logMessage = `${playerTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
        break;
      case 'defend':
        newBattleState.playerStatusEffect = 'defended';
        logMessage = `${playerTeddyData.name} takes a defensive stance!`;
        break;
      case 'special':
        if (newBattleState.playerEnergy >= 2) {
          const specialResult = useSpecialAbility(playerTeddyData, opponentTeddyData, newBattleState);
          newBattleState = { ...newBattleState, ...specialResult.battleState };
          damage = specialResult.damage;
          energyCost = 2;
          logMessage = specialResult.logMessage;
        } else {
          logMessage = "Not enough energy for special move!";
          return newBattleState;
        }
        break;
      default:
        return newBattleState;
    }

    newBattleState.playerEnergy -= energyCost;
    newBattleState.battleLog.push(logMessage);
    newBattleState.moveHistory.push(action);
    newBattleState.comboMeter = Math.min(newBattleState.comboMeter + 20, 100);
    newBattleState.powerUpMeter = Math.min(newBattleState.powerUpMeter + 10, 100);
    newBattleState.currentTurn = 'opponent';
    newBattleState.roundCount++;

    // Check for combo
    const combo = checkForCombo(newBattleState.moveHistory);
    if (combo) {
      const comboEffect = applyComboEffect(combo, playerTeddyData, opponentTeddyData);
      newBattleState = { ...newBattleState, ...comboEffect };
      newBattleState.battleLog.push(`${playerTeddyData.name} unleashes ${combo.name} combo!`);
      newBattleState.comboMeter = 0;
    }

    // Apply weather effects
    if (newBattleState.weatherEffect) {
      newBattleState = applyWeatherEffect(newBattleState, playerTeddyData, opponentTeddyData);
    }

    // Apply status effects
    newBattleState = applyStatusEffects(newBattleState, playerTeddyData, opponentTeddyData);

    setBattleState(newBattleState);
    updateBattleMutation.mutate(newBattleState);

    // Simulate opponent's turn after a delay
    setTimeout(() => {
      handleOpponentTurn(newBattleState);
    }, 1500);
  };

  const handleOpponentTurn = (currentState) => {
    let newBattleState = { ...currentState };
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    let damage = 0;
    let logMessage = '';

    const isCritical = rollForCritical(opponentTeddyData);

    switch (randomAction) {
      case 'attack':
        damage = calculateDamage(opponentTeddyData, playerTeddyData, newBattleState.playerStatusEffect, isCritical);
        newBattleState.playerHealth -= damage;
        logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
        break;
      case 'defend':
        newBattleState.opponentStatusEffect = 'defended';
        logMessage = `${opponentTeddyData.name} takes a defensive stance!`;
        break;
      case 'special':
        if (newBattleState.opponentEnergy >= 2) {
          const specialResult = useSpecialAbility(opponentTeddyData, playerTeddyData, newBattleState);
          newBattleState = { ...newBattleState, ...specialResult.battleState };
          damage = specialResult.damage;
          newBattleState.opponentEnergy -= 2;
          logMessage = specialResult.logMessage;
        } else {
          damage = calculateDamage(opponentTeddyData, playerTeddyData, newBattleState.playerStatusEffect, isCritical);
          newBattleState.playerHealth -= damage;
          logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
        }
        break;
    }

    newBattleState.battleLog.push(logMessage);
    newBattleState.currentTurn = 'player';
    newBattleState.playerEnergy = Math.min(newBattleState.playerEnergy + 1, 3);
    newBattleState.opponentEnergy = Math.min(newBattleState.opponentEnergy + 1, 3);
    newBattleState.roundCount++;

    // Apply battle events
    if (newBattleState.roundCount % 3 === 0) {
      newBattleState = applyBattleEvent(newBattleState);
    }

    // Update weather
    if (newBattleState.roundCount % 5 === 0) {
      newBattleState.weatherEffect = getWeatherEffect();
      newBattleState.battleLog.push(`The weather has changed to ${newBattleState.weatherEffect.name}!`);
    }

    // Apply weather effects
    if (newBattleState.weatherEffect) {
      newBattleState = applyWeatherEffect(newBattleState, playerTeddyData, opponentTeddyData);
    }

    // Apply status effects
    newBattleState = applyStatusEffects(newBattleState, playerTeddyData, opponentTeddyData);

    setBattleState(newBattleState);
    updateBattleMutation.mutate(newBattleState);
  };

  const applyWeatherEffect = (state, player, opponent) => {
    const weatherEffect = state.weatherEffect;
    let newState = { ...state };
    
    newState.playerHealth = Math.max(0, Math.min(100, newState.playerHealth + weatherEffect.healthEffect));
    newState.opponentHealth = Math.max(0, Math.min(100, newState.opponentHealth + weatherEffect.healthEffect));
    
    newState.battleLog.push(`${weatherEffect.name} affects both teddies!`);
    
    return newState;
  };

  const applyStatusEffects = (state, player, opponent) => {
    let newState = { ...state };
    
    if (newState.playerStatusEffect) {
      const playerEffect = applyStatusEffect(player, newState.playerStatusEffect);
      newState.playerHealth = Math.max(0, newState.playerHealth - playerEffect.damage);
      newState.battleLog.push(`${player.name} is affected by ${newState.playerStatusEffect}!`);
    }
    
    if (newState.opponentStatusEffect) {
      const opponentEffect = applyStatusEffect(opponent, newState.opponentStatusEffect);
      newState.opponentHealth = Math.max(0, newState.opponentHealth - opponentEffect.damage);
      newState.battleLog.push(`${opponent.name} is affected by ${newState.opponentStatusEffect}!`);
    }
    
    return newState;
  };

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      const winner = battleState.playerHealth > 0 ? playerTeddyData.name : opponentTeddyData.name;
      setBattleState(prevState => ({
        ...prevState,
        battleLog: [...prevState.battleLog, `Battle ended! ${winner} wins!`],
      }));
      // Here you would typically update the database, award XP, etc.
    }
  }, [battleState.playerHealth, battleState.opponentHealth, playerTeddyData, opponentTeddyData]);

  return {
    battleState,
    handleAction,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData
  };
};