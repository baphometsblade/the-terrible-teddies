import { BattleState, TeddyCard } from '../types/types';
import { WeatherType } from '../components/Battle/WeatherSystem/WeatherDisplay';

interface WeatherEffect {
  name: WeatherType;
  duration: number;
  onAttack?: (damage: number) => number;
  onDefense?: (defense: number) => number;
  onEnergyCost?: (cost: number) => number;
  onTurnStart?: (state: BattleState) => Partial<BattleState>;
  description: string;
}

export const weatherEffects: Record<WeatherType, WeatherEffect> = {
  sunny: {
    name: 'sunny',
    duration: 3,
    onAttack: (damage) => Math.floor(damage * 1.2),
    description: 'Increases attack power by 20%'
  },
  rainy: {
    name: 'rainy',
    duration: 3,
    onDefense: (defense) => Math.floor(defense * 1.2),
    description: 'Increases defense power by 20%'
  },
  stormy: {
    name: 'stormy',
    duration: 2,
    onEnergyCost: (cost) => Math.max(0, cost - 1),
    description: 'Reduces special ability energy cost by 1'
  },
  snowy: {
    name: 'snowy',
    duration: 2,
    onAttack: (damage) => Math.floor(damage * 0.8),
    description: 'Reduces attack power by 20%'
  },
  windy: {
    name: 'windy',
    duration: 2,
    onAttack: (damage) => Math.random() < 0.25 ? 0 : damage,
    description: '25% chance to miss attacks'
  },
  clear: {
    name: 'clear',
    duration: 1,
    description: 'Normal weather conditions'
  }
};

export const getRandomWeather = (): WeatherEffect => {
  const weathers = Object.values(weatherEffects);
  return weathers[Math.floor(Math.random() * weathers.length)];
};

export const applyWeatherEffect = (state: BattleState): BattleState => {
  if (!state.weatherEffect) return state;

  const effect = weatherEffects[state.weatherEffect as WeatherType];
  if (!effect) return state;

  let newState = { ...state };

  if (effect.onTurnStart) {
    newState = { ...newState, ...effect.onTurnStart(state) };
  }

  return {
    ...newState,
    battleLog: [
      ...newState.battleLog,
      `${effect.name} weather affects the battle: ${effect.description}`
    ]
  };
};

export const calculateWeatherModifiedDamage = (
  damage: number,
  weather: WeatherType | undefined,
  attacker: TeddyCard
): number => {
  if (!weather) return damage;

  const effect = weatherEffects[weather];
  if (!effect || !effect.onAttack) return damage;

  return effect.onAttack(damage);
};

export const calculateWeatherModifiedDefense = (
  defense: number,
  weather: WeatherType | undefined,
  defender: TeddyCard
): number => {
  if (!weather) return defense;

  const effect = weatherEffects[weather];
  if (!effect || !effect.onDefense) return defense;

  return effect.onDefense(defense);
};

export const calculateWeatherModifiedEnergyCost = (
  cost: number,
  weather: WeatherType | undefined
): number => {
  if (!weather) return cost;

  const effect = weatherEffects[weather];
  if (!effect || !effect.onEnergyCost) return cost;

  return effect.onEnergyCost(cost);
};