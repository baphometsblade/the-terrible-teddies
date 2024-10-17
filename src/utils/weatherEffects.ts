import { BattleState } from '../types/types';

export type WeatherEffect = {
  name: string;
  description: string;
  effect: (state: BattleState) => BattleState;
};

const weatherEffects: Record<string, WeatherEffect> = {
  sunny: {
    name: 'Sunny',
    description: 'Increases attack damage by 20%',
    effect: (state) => ({
      ...state,
      playerAttackBoost: (state.playerAttackBoost || 0) + 0.2,
      opponentAttackBoost: (state.opponentAttackBoost || 0) + 0.2,
    }),
  },
  rainy: {
    name: 'Rainy',
    description: 'Increases defense by 20%',
    effect: (state) => ({
      ...state,
      playerDefenseBoost: (state.playerDefenseBoost || 0) + 0.2,
      opponentDefenseBoost: (state.opponentDefenseBoost || 0) + 0.2,
    }),
  },
  windy: {
    name: 'Windy',
    description: 'Increases energy regeneration by 1',
    effect: (state) => ({
      ...state,
      playerEnergyRegen: (state.playerEnergyRegen || 0) + 1,
      opponentEnergyRegen: (state.opponentEnergyRegen || 0) + 1,
    }),
  },
};

export const getRandomWeather = (): WeatherEffect => {
  const weatherKeys = Object.keys(weatherEffects);
  const randomKey = weatherKeys[Math.floor(Math.random() * weatherKeys.length)];
  return weatherEffects[randomKey];
};

export const applyWeatherEffect = (state: BattleState, weather: WeatherEffect): BattleState => {
  const newState = weather.effect(state);
  return {
    ...newState,
    battleLog: [...newState.battleLog, `The weather is ${weather.name}. ${weather.description}`],
  };
};