export const applyCardEffect = (state, card, isOpponent) => {
  const newState = { ...state };
  const target = isOpponent ? 'player' : 'opponent';
  let effectDescription = '';

  switch(card.type) {
    case 'Action':
      const damage = card.energy_cost * 2;
      newState[`${target}HP`] = Math.max(0, newState[`${target}HP`] - damage);
      effectDescription = `${card.name} deals ${damage} damage to the ${target}!`;
      break;
    case 'Trap':
      newState.activeEffects[isOpponent ? 'opponent' : 'player'].push(card);
      effectDescription = `${card.name} has been set as a trap.`;
      break;
    case 'Special':
      const heal = card.energy_cost;
      newState[`${isOpponent ? 'opponent' : 'player'}HP`] = Math.min(30, newState[`${isOpponent ? 'opponent' : 'player'}HP`] + heal);
      effectDescription = `${card.name} heals the ${isOpponent ? 'opponent' : 'player'} for ${heal} HP!`;
      break;
    case 'Defense':
      newState.activeEffects[isOpponent ? 'opponent' : 'player'].push(card);
      effectDescription = `${card.name} provides defense for the ${isOpponent ? 'opponent' : 'player'}.`;
      break;
    case 'Boost':
      newState.momentumGauge = Math.min(10, newState.momentumGauge + card.energy_cost);
      effectDescription = `${card.name} boosts the momentum gauge by ${card.energy_cost}!`;
      break;
  }

  newState.gameLog = [...newState.gameLog, { player: isOpponent ? 'Opponent' : 'You', action: effectDescription }];
  return newState;
};

export const checkGameOver = (state) => {
  if (state.playerHP <= 0 || state.opponentHP <= 0) {
    return {
      isGameOver: true,
      winner: state.playerHP > 0 ? 'player' : 'opponent'
    };
  }
  return { isGameOver: false, winner: null };
};
