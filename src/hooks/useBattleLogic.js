import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getSpecialAbility } from '../utils/specialAbilities';
import { applyBattleEvent } from '../utils/battleEvents';
import { getWeatherEffect } from '../utils/weatherEffects';
import { applyWeatherEffect, applyStatusEffects } from '../utils/battleEffects';
import { calculateDamage, rollForCritical } from '../utils/battleUtils';
import { getAIAction } from '../utils/AIOpponent';

export const useBattleLogic = (playerTeddy, opponentTeddy) => {
  const [battleState, setBattleState] = useState({
    playerHealth: 100,
    opponentHealth: 100,
    playerEnergy: 3,
    opponentEnergy: 3,
    currentTurn: 'player',
    weatherEffect: null,
    powerUpMeter: 0,
    comboMeter: 0,
    battleLog: [],
    roundCount: 0,
    playerStatusEffects: [],
    opponentStatusEffects: [],
    playerCombo: [],
    opponentCombo: [],
  });

  const { data: playerTeddyData, isLoading: isLoadingPlayerTeddy } = useQuery({
    queryKey: ['playerTeddy', playerTeddy?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', playerTeddy.id)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
    enabled: !!playerTeddy,
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponentTeddy } = useQuery({
    queryKey: ['opponentTeddy', opponentTeddy?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', opponentTeddy.id)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
    enabled: !!opponentTeddy,
  });

  useEffect(() => {
    if (battleState.roundCount % 3 === 0) {
      const updatedState = applyBattleEvent(battleState);
      setBattleState(updatedState);
    }

    if (battleState.roundCount % 5 === 0) {
      const newWeatherEffect = getWeatherEffect();
      setBattleState(prevState => ({
        ...prevState,
        weatherEffect: newWeatherEffect,
        battleLog: [...prevState.battleLog, `The weather has changed to ${newWeatherEffect.name}!`],
      }));
    }

    if (battleState.weatherEffect) {
      const weatherUpdatedState = applyWeatherEffect(battleState, playerTeddyData, opponentTeddyData);
      setBattleState(weatherUpdatedState);
    }

    const statusUpdatedState = applyStatusEffects(battleState, playerTeddyData, opponentTeddyData);
    setBattleState(statusUpdatedState);
  }, [battleState.roundCount, battleState.weatherEffect, playerTeddyData, opponentTeddyData]);

    // Add random events
    if (Math.random() < 0.1) { // 10% chance of a random event each round
      const randomEvent = getRandomEvent();
      const updatedState = applyRandomEvent(battleState, randomEvent);
      setBattleState(updatedState);
    }
  }, [battleState.roundCount, battleState.weatherEffect, playerTeddyData, opponentTeddyData]);

  const handleAction = async (action) => {
    let newState = { ...battleState };
    let damage = 0;

    if (action === 'attack') {
      const isCritical = rollForCritical(playerTeddyData);
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newState.weatherEffect, isCritical);
      newState.opponentHealth -= damage;
      newState.battleLog.push(`${playerTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`);
      newState.playerCombo.push('attack');
    } else if (action === 'defend') {
      newState.playerEnergy += 1;
      newState.playerDefenseBoost += Math.floor(playerTeddyData.defense * 0.2);
      newState.battleLog.push(`${playerTeddyData.name} defends and gains 1 energy and ${newState.playerDefenseBoost} defense!`);
      newState.playerCombo.push('defend');
    } else if (action === 'special' && newState.playerEnergy >= 2) {
      const specialAbility = playerTeddyData.specialAbility;
      const specialResult = specialAbility.effect(playerTeddyData, opponentTeddyData, newState);
      newState = { ...newState, ...specialResult };
      newState.playerEnergy -= 2;
      newState.playerCombo.push('special');
    }

    newState.powerUpMeter = Math.min(newState.powerUpMeter + 10, 100);
    newState.comboMeter = Math.min(newState.comboMeter + 20, 100);
    newState.currentTurn = 'opponent';
    newState.roundCount += 1;

    if (newState.playerCombo.length > 3) {
      newState.playerCombo.shift();
    }

    // Check for combo
    if (newState.playerCombo.length >= 3) {
      const comboEffect = checkForCombo(newState.playerCombo);
      if (comboEffect) {
        newState = applyComboEffect(newState, comboEffect, playerTeddyData, opponentTeddyData);
      }
    }

    setBattleState(newState);
    return newState;
  };

  const handlePowerUp = () => {
    if (battleState.powerUpMeter === 100) {
      const newState = {
        ...battleState,
        playerEnergy: battleState.playerEnergy + 2,
        powerUpMeter: 0,
        battleLog: [...battleState.battleLog, `${playerTeddyData.name} uses Power Up and gains 2 energy!`],
      };
      setBattleState(newState);
    }
  };

  const handleCombo = () => {
    if (battleState.comboMeter === 100) {
      const comboDamage = playerTeddyData.attack * 2;
      const newState = {
        ...battleState,
        opponentHealth: Math.max(0, battleState.opponentHealth - comboDamage),
        comboMeter: 0,
        battleLog: [...battleState.battleLog, `${playerTeddyData.name} unleashes a devastating combo attack for ${comboDamage} damage!`],
      };
      setBattleState(newState);
    }
  };

  const aiAction = async () => {
    const action = getAIAction(opponentTeddyData, playerTeddyData, battleState);
    let newState = { ...battleState };
    let damage = 0;

    if (action === 'attack') {
      damage = calculateDamage(opponentTeddyData, playerTeddyData, newState.weatherEffect);
      newState.playerHealth -= damage;
      newState.battleLog.push(`${opponentTeddyData.name} attacks for ${damage} damage!`);
      newState.opponentCombo.push('attack');
    } else if (action === 'defend') {
      newState.opponentEnergy += 1;
      newState.battleLog.push(`${opponentTeddyData.name} defends and gains 1 energy!`);
      newState.opponentCombo.push('defend');
    } else if (action === 'special' && newState.opponentEnergy >= 2) {
      const specialAbility = opponentTeddyData.specialAbility;
      const specialResult = specialAbility.effect(opponentTeddyData, playerTeddyData, newState);
      newState = { ...newState, ...specialResult };
      newState.opponentEnergy -= 2;
      newState.opponentCombo.push('special');
    }

    setBattleState(newState);
    return { action, newState };
  };

  return {
    battleState,
    handleAction,
    handlePowerUp,
    handleCombo,
    aiAction,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData,
  };
};

const getRandomEvent = () => {
  const events = [
    { name: 'Sudden Gust', effect: (state) => ({ ...state, playerDefenseBoost: state.playerDefenseBoost - 2, opponentDefenseBoost: state.opponentDefenseBoost - 2 }) },
    { name: 'Energy Surge', effect: (state) => ({ ...state, playerEnergy: state.playerEnergy + 1, opponentEnergy: state.opponentEnergy + 1 }) },
    { name: 'Healing Mist', effect: (state) => ({ ...state, playerHealth: Math.min(100, state.playerHealth + 10), opponentHealth: Math.min(100, state.opponentHealth + 10) }) },
  ];
  return events[Math.floor(Math.random() * events.length)];
};

const applyRandomEvent = (state, event) => {
  const newState = event.effect(state);
  newState.battleLog.push(`Random event: ${event.name}!`);
  return newState;
};

const checkForCombo = (combo) => {
  const comboEffects = {
    'attack,attack,attack': { name: 'Triple Strike', effect: (damage) => damage * 1.5 },
    'defend,defend,defend': { name: 'Iron Wall', effect: (defense) => defense * 2 },
    'special,special,special': { name: 'Ultimate Power', effect: (damage) => damage * 2 },
    'attack,defend,special': { name: 'Balanced Assault', effect: (state) => ({ ...state, playerEnergy: state.playerEnergy + 2 }) },
  };
  return comboEffects[combo.join(',')];
};

const applyComboEffect = (state, comboEffect, attacker, defender) => {
  let newState = { ...state };
  if (comboEffect.name === 'Triple Strike' || comboEffect.name === 'Ultimate Power') {
    const damage = calculateDamage(attacker, defender, state.weatherEffect);
    newState.opponentHealth -= Math.floor(comboEffect.effect(damage));
  } else if (comboEffect.name === 'Iron Wall') {
    newState.playerDefenseBoost = Math.floor(comboEffect.effect(newState.playerDefenseBoost));
  } else if (comboEffect.name === 'Balanced Assault') {
    newState = comboEffect.effect(newState);
  }
  newState.battleLog.push(`${attacker.name} unleashes the ${comboEffect.name} combo!`);
  newState.playerCombo = [];
  return newState;
};
