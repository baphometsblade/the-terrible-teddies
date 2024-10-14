export const applyWeatherEffect = (state, player, opponent) => {
  const weatherEffect = state.weatherEffect;
  let newState = { ...state };
  
  newState.playerHealth = Math.max(0, Math.min(100, newState.playerHealth + weatherEffect.healthEffect));
  newState.opponentHealth = Math.max(0, Math.min(100, newState.opponentHealth + weatherEffect.healthEffect));
  
  newState.battleLog = [...newState.battleLog, `${weatherEffect.name} affects both teddies!`];
  
  return newState;
};

export const applyStatusEffects = (state, player, opponent) => {
  let newState = { ...state };
  
  if (newState.playerStatusEffect) {
    const playerEffect = applyStatusEffect(player, newState.playerStatusEffect);
    newState.playerHealth = Math.max(0, newState.playerHealth - playerEffect.damage);
    newState.battleLog = [...newState.battleLog, `${player.name} is affected by ${newState.playerStatusEffect}!`];
  }
  
  if (newState.opponentStatusEffect) {
    const opponentEffect = applyStatusEffect(opponent, newState.opponentStatusEffect);
    newState.opponentHealth = Math.max(0, newState.opponentHealth - opponentEffect.damage);
    newState.battleLog = [...newState.battleLog, `${opponent.name} is affected by ${newState.opponentStatusEffect}!`];
  }
  
  return newState;
};

const applyStatusEffect = (teddy, statusEffect) => {
  switch (statusEffect) {
    case 'burn':
      return { damage: Math.floor(teddy.maxHealth * 0.1) };
    case 'poison':
      return { damage: Math.floor(teddy.maxHealth * 0.08) };
    case 'freeze':
      return { damage: 0, skipTurn: true };
    case 'paralyze':
      return { damage: 0, reduceSpeed: true };
    case 'confusion':
      return { damage: 0, selfDamageChance: 0.3 };
    default:
      return { damage: 0 };
  }
};
