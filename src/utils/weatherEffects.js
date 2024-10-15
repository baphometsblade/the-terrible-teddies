const weatherEffects = [
  {
    name: "Sunny Day",
    description: "The warm sun energizes the teddies, increasing their attack power.",
    effect: (state) => ({
      ...state,
      playerAttackBoost: state.playerAttackBoost + 2,
      opponentAttackBoost: state.opponentAttackBoost + 2,
    }),
  },
  {
    name: "Rainy Day",
    description: "The gloomy weather dampens the teddies' spirits, reducing their defense.",
    effect: (state) => ({
      ...state,
      playerDefenseBoost: Math.max(0, state.playerDefenseBoost - 2),
      opponentDefenseBoost: Math.max(0, state.opponentDefenseBoost - 2),
    }),
  },
  {
    name: "Windy Day",
    description: "Strong winds make it harder for the teddies to move, reducing their energy gain.",
    effect: (state) => ({
      ...state,
      playerEnergyGain: 2,
      opponentEnergyGain: 2,
    }),
  },
  {
    name: "Foggy Day",
    description: "The thick fog reduces visibility, increasing the chance of critical hits.",
    effect: (state) => ({
      ...state,
      playerCriticalChanceBoost: 5,
      opponentCriticalChanceBoost: 5,
    }),
  },
];

export const getRandomWeatherEffect = () => {
  return weatherEffects[Math.floor(Math.random() * weatherEffects.length)];
};

export const applyWeatherEffect = (state, weatherEffect) => {
  const updatedState = weatherEffect.effect(state);
  return {
    ...updatedState,
    battleLog: [
      ...updatedState.battleLog,
      `Weather Effect: ${weatherEffect.name} - ${weatherEffect.description}`,
    ],
  };
};