import { WeatherEffect, BattleState } from '../types/types';

export const weatherEffects: WeatherEffect[] = [
  {
    name: 'Sunny Day',
    description: 'All teddies gain +1 attack',
    effect: (state: BattleState) => ({
      ...state,
      playerField: state.playerField.map(card => ({ ...card, attack: card.attack + 1 })),
      opponentField: state.opponentField.map(card => ({ ...card, attack: card.attack + 1 })),
    }),
    duration: 3,
  },
  {
    name: 'Rainy Day',
    description: 'All teddies lose 1 energy at the start of their turn',
    effect: (state: BattleState) => ({
      ...state,
      playerEnergy: state.playerEnergy - 1,
      opponentEnergy: state.opponentEnergy - 1,
    }),
    duration: 3,
  },
  {
    name: 'Thunderstorm',
    description: 'Each teddy has a 20% chance to be stunned for 1 turn',
    effect: (state: BattleState) => {
      const stunPlayer = Math.random() < 0.2;
      const stunOpponent = Math.random() < 0.2;
      return {
        ...state,
        playerStunned: stunPlayer,
        opponentStunned: stunOpponent,
        battleLog: [
          ...state.battleLog,
          stunPlayer ? "Player's teddy was stunned by lightning!" : '',
          stunOpponent ? "Opponent's teddy was stunned by lightning!" : '',
        ].filter(Boolean),
      };
    },
    duration: 2,
  },
  {
    name: 'Sandstorm',
    description: 'All attacks have a 25% chance to miss',
    effect: (state: BattleState) => state, // This effect will be handled in the attack logic
    duration: 3,
  },
];

export const getRandomWeather = (): WeatherEffect => {
  return weatherEffects[Math.floor(Math.random() * weatherEffects.length)];
};

export const applyWeatherEffect = (state: BattleState): BattleState => {
  if (state.weatherEffect) {
    const updatedState = state.weatherEffect.effect(state);
    updatedState.weatherEffect.duration--;
    if (updatedState.weatherEffect.duration <= 0) {
      updatedState.weatherEffect = null;
      updatedState.battleLog.push("The weather has cleared");
    }
    return updatedState;
  }
  return state;
};