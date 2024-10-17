import { TeddyCard } from '../types/types';

export type WeatherEffect = {
  name: string;
  description: string;
  effect: (attacker: TeddyCard, defender: TeddyCard) => number;
};

const weatherEffects: WeatherEffect[] = [
  {
    name: 'Sunny',
    description: 'Increases attack power by 20%',
    effect: (attacker, defender) => Math.floor(attacker.attack * 1.2),
  },
  {
    name: 'Rainy',
    description: 'Decreases attack power by 10%',
    effect: (attacker, defender) => Math.floor(attacker.attack * 0.9),
  },
  {
    name: 'Windy',
    description: 'Increases defense by 15%',
    effect: (attacker, defender) => Math.floor(defender.defense * 1.15),
  },
  {
    name: 'Stormy',
    description: 'Random effect: either increases or decreases attack by 25%',
    effect: (attacker, defender) => Math.floor(attacker.attack * (Math.random() < 0.5 ? 0.75 : 1.25)),
  },
];

export const getRandomWeather = (): WeatherEffect => {
  return weatherEffects[Math.floor(Math.random() * weatherEffects.length)];
};

export const applyWeatherEffect = (attacker: TeddyCard, defender: TeddyCard, weather: WeatherEffect): number => {
  return weather.effect(attacker, defender);
};