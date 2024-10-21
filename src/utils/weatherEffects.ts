import { WeatherEffect } from '../types/types';

const weatherEffects: WeatherEffect[] = [
  {
    name: 'Sunny',
    description: 'Increases attack damage',
    effect: (damage: number) => damage * 1.2
  },
  {
    name: 'Rainy',
    description: 'Decreases attack damage',
    effect: (damage: number) => damage * 0.8
  },
  {
    name: 'Windy',
    description: 'Increases critical hit chance',
    effect: (damage: number) => damage // This effect is handled separately in critical hit logic
  },
  {
    name: 'Foggy',
    description: 'Decreases accuracy',
    effect: (damage: number) => Math.random() < 0.2 ? 0 : damage // 20% chance to miss
  }
];

export const getRandomWeather = (): WeatherEffect => {
  return weatherEffects[Math.floor(Math.random() * weatherEffects.length)];
};

export const applyWeatherEffect = (damage: number, weather: WeatherEffect, actionType: 'attack' | 'special'): number => {
  if (actionType === 'special') {
    // Special moves are not affected by weather
    return damage;
  }
  return weather.effect(damage);
};