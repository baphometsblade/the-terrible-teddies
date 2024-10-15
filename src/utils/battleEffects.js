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

export const applyStatusEffect = (teddy, statusEffect) => {
  switch (statusEffect) {
    case 'burn':
      return { damage: Math.floor(teddy.maxHealth * 0.1), effect: 'Attack reduced' };
    case 'poison':
      return { damage: Math.floor(teddy.maxHealth * 0.08), effect: 'Defense reduced' };
    case 'freeze':
      return { damage: 0, effect: 'Speed reduced' };
    case 'paralyze':
      return { damage: 0, effect: 'May skip turn' };
    case 'confusion':
      return { damage: 0, effect: 'May hurt self' };
    default:
      return { damage: 0, effect: null };
  }
};

export const applyRageEffect = (state, teddy) => {
  let newState = { ...state };
  const rageBoost = Math.floor(teddy.attack * (newState.rage / 100));
  newState.battleLog.push(`${teddy.name}'s rage boosts attack by ${rageBoost}!`);
  return {
    ...newState,
    playerAttackBoost: newState.playerAttackBoost + rageBoost,
  };
};