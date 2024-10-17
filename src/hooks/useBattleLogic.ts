import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { checkForCombo, applyCombo } from '../utils/comboSystem';
import { generatePowerUps, applyPowerUp } from '../utils/powerUpSystem';
import { getAIAction } from '../utils/AIOpponent';
import { applyWeatherEffect, getRandomWeather } from '../utils/weatherEffects';
import { applyBattleResults } from '../utils/levelSystem';
import { BattleState, TeddyCard, PowerUp } from '../types/types';

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
    activeEffects: [],
  });

  const [weatherEffect, setWeatherEffect] = useState(getRandomWeather());
  const [powerUps, setPowerUps] = useState<PowerUp[]>(generatePowerUps());

  const { data: playerTeddyData, isLoading: isLoadingPlayerTeddy } = useQuery({
    queryKey: ['playerTeddy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', 1)  // Assuming player teddy has id 1
        .single();
      if (error) throw error;
      return data as TeddyCard;
    },
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponentTeddy } = useQuery({
    queryKey: ['opponentTeddy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', 2)  // Assuming opponent teddy has id 2
        .single();
      if (error) throw error;
      return data as TeddyCard;
    },
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

    switch (action) {
      case 'attack':
        const damage = applyWeatherEffect('attack', playerTeddyData.attack, weatherEffect);
        newState.opponentHealth = Math.max(0, newState.opponentHealth - damage);
        newState.battleLog.push(`${playerTeddyData.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        newState.playerEnergy = Math.min(5, newState.playerEnergy + 1);
        newState.battleLog.push(`${playerTeddyData.name} defends and gains 1 energy.`);
        break;
      case 'special':
        if (newState.playerEnergy >= 2) {
          const specialDamage = playerTeddyData.attack * 1.5;
          newState.opponentHealth = Math.max(0, newState.opponentHealth - specialDamage);
          newState.playerEnergy -= 2;
          newState.battleLog.push(`${playerTeddyData.name} uses a special move for ${specialDamage} damage!`);
        }
        break;
    }

    const combo = checkForCombo(newState.moveHistory);
    if (combo) {
      newState = applyCombo(combo, newState, playerTeddyData);
      newState.comboMeter = 0;
    } else {
      newState.comboMeter = Math.min(100, newState.comboMeter + 20);
    }

    newState.powerUpMeter = Math.min(100, newState.powerUpMeter + 10);
    newState.currentTurn = 'opponent';
    newState.roundCount++;

    setBattleState(newState);
    setTimeout(aiAction, 1000);
  };

  const handlePowerUp = () => {
    if (battleState.powerUpMeter === 100 && powerUps.length > 0) {
      const powerUp = powerUps[0];
      const newState = applyPowerUp(powerUp, battleState);
      setBattleState(newState);
      setPowerUps(powerUps.slice(1));
    }
  };

  const handleCombo = () => {
    if (battleState.comboMeter === 100 && playerTeddyData) {
      const newState = applyCombo('attack,attack,attack', battleState, playerTeddyData);
      newState.comboMeter = 0;
      setBattleState(newState);
    }
  };

  const aiAction = () => {
    if (!opponentTeddyData || !playerTeddyData) return;

    const action = getAIAction(opponentTeddyData, playerTeddyData, battleState);
    let newState = { ...battleState };

    switch (action) {
      case 'attack':
        const damage = applyWeatherEffect('attack', opponentTeddyData.attack, weatherEffect);
        newState.playerHealth = Math.max(0, newState.playerHealth - damage);
        newState.battleLog.push(`${opponentTeddyData.name} attacks for ${damage} damage!`);
        break;
      case 'defend':
        newState.opponentEnergy = Math.min(5, newState.opponentEnergy + 1);
        newState.battleLog.push(`${opponentTeddyData.name} defends and gains 1 energy.`);
        break;
      case 'special':
        if (newState.opponentEnergy >= 2) {
          const specialDamage = opponentTeddyData.attack * 1.5;
          newState.playerHealth = Math.max(0, newState.playerHealth - specialDamage);
          newState.opponentEnergy -= 2;
          newState.battleLog.push(`${opponentTeddyData.name} uses a special move for ${specialDamage} damage!`);
        }
        break;
    }

    newState.currentTurn = 'player';
    newState.roundCount++;

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
  };
};