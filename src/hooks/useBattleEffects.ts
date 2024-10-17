import { applyBattleEffect } from '../utils/battleEffects';
import { getRandomWeatherEffect, applyWeatherEffect } from '../utils/weatherEffects';

export const useBattleEffects = (battleState, updateBattleState, weatherEffect, setWeatherEffect) => {
  const applyEffects = () => {
    if (battleState.roundCount % 3 === 0) {
      const updatedState = applyBattleEffect(battleState);
      updateBattleState(updatedState);
    }

    if (battleState.roundCount % 5 === 0) {
      const newWeatherEffect = getRandomWeatherEffect();
      setWeatherEffect(newWeatherEffect);
      updateBattleState((prevState) => ({
        ...prevState,
        battleLog: [...prevState.battleLog, `The weather has changed to ${newWeatherEffect.name}!`],
      }));
    }

    const weatherUpdatedState = applyWeatherEffect(battleState, weatherEffect);
    updateBattleState(weatherUpdatedState);

    if (Math.random() < 0.1) {
      const randomEvent = getRandomEvent();
      const updatedState = applyRandomEvent(battleState, randomEvent);
      updateBattleState(updatedState);
    }
  };

  return { applyEffects };
};

const getRandomEvent = () => {
  const events = [
    { name: 'Sudden Gust', effect: (state) => ({ ...state, playerDefenseBoost: state.playerDefenseBoost - 2, opponentDefenseBoost: state.opponentDefenseBoost - 2 }) },
    { name: 'Energy Surge', effect: (state) => ({ ...state, playerEnergy: state.playerEnergy + 1, opponentEnergy: state.opponentEnergy + 1 }) },
    { name: 'Healing Mist', effect: (state) => ({ ...state, playerHealth: Math.min(100, state.playerHealth + 10), opponentHealth: Math.min(100, state.opponentHealth + 10) }) },
    { name: 'Rage Inducer', effect: (state) => ({ ...state, rage: Math.min(100, state.rage + 20), aiRage: Math.min(100, state.aiRage + 20) }) },
    { name: 'Stuffing Storm', effect: (state) => ({ ...state, playerAttackBoost: state.playerAttackBoost + 3, opponentAttackBoost: state.opponentAttackBoost + 3 }) },
  ];
  return events[Math.floor(Math.random() * events.length)];
};

const applyRandomEvent = (state, event) => {
  const newState = event.effect(state);
  newState.battleLog.push(`Random event: ${event.name}!`);
  return newState;
};