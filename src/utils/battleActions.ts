import { BattleState, TeddyCard } from '../types/types';
import { applyWeatherEffect } from './weatherEffects';

export const playCard = (state: BattleState, card: TeddyCard, isPlayer: boolean): BattleState => {
  const newState = { ...state };
  if (isPlayer) {
    newState.playerField = [...newState.playerField, card];
    newState.playerHand = newState.playerHand.filter(c => c.id !== card.id);
    newState.playerEnergy -= card.energyCost;
  } else {
    newState.opponentField = [...newState.opponentField, card];
    newState.opponentHand = newState.opponentHand.filter(c => c.id !== card.id);
    newState.opponentEnergy -= card.energyCost;
  }
  newState.battleLog.push(`${isPlayer ? 'Player' : 'Opponent'} played ${card.name}`);
  return newState;
};

export const attack = (state: BattleState, attacker: TeddyCard, target: TeddyCard, isPlayer: boolean): BattleState => {
  let newState = { ...state };
  let damage = Math.max(0, attacker.attack - target.defense);

  // Apply weather effects
  if (newState.weatherEffect && newState.weatherEffect.name === 'Sandstorm' && Math.random() < 0.25) {
    newState.battleLog.push(`${attacker.name}'s attack missed due to the sandstorm!`);
    return newState;
  }

  if (isPlayer) {
    newState.opponentHealth -= damage;
    newState.opponentField = newState.opponentField.filter(c => c.id !== target.id);
  } else {
    newState.playerHealth -= damage;
    newState.playerField = newState.playerField.filter(c => c.id !== target.id);
  }
  newState.battleLog.push(`${attacker.name} dealt ${damage} damage to ${target.name}`);

  // Apply weather effects after the attack
  newState = applyWeatherEffect(newState);

  return newState;
};

export const useSpecialAbility = (state: BattleState, card: TeddyCard, isPlayer: boolean): BattleState => {
  let newState = { ...state };
  const updatedState = card.specialAbility.effect(newState, card);
  newState = { ...newState, ...updatedState };

  if (isPlayer) {
    newState.playerEnergy -= card.specialAbility.energyCost;
    newState.playerCooldowns = { ...newState.playerCooldowns, [card.id]: card.specialAbility.cooldown };
  } else {
    newState.opponentEnergy -= card.specialAbility.energyCost;
    newState.opponentCooldowns = { ...newState.opponentCooldowns, [card.id]: card.specialAbility.cooldown };
  }
  newState.battleLog.push(`${isPlayer ? 'Player' : 'Opponent'} used ${card.name}'s ${card.specialAbility.name}`);

  // Apply weather effects after the special ability
  newState = applyWeatherEffect(newState);

  return newState;
};

export const endTurn = (state: BattleState): BattleState => {
  let newState = { ...state };
  const isPlayerTurn = newState.currentTurn === 'player';

  // Reduce cooldowns
  const cooldownField = isPlayerTurn ? 'playerCooldowns' : 'opponentCooldowns';
  newState[cooldownField] = Object.fromEntries(
    Object.entries(newState[cooldownField]).map(([id, cooldown]) => [id, Math.max(0, cooldown - 1)])
  );

  // Switch turns
  newState.currentTurn = isPlayerTurn ? 'opponent' : 'player';
  newState[isPlayerTurn ? 'opponentEnergy' : 'playerEnergy'] += 1;
  newState.turnCount += 1;
  newState.battleLog.push(`${isPlayerTurn ? 'Player' : 'Opponent'} ended their turn`);

  // Apply weather effects
  newState = applyWeatherEffect(newState);

  // Randomly apply new weather effect
  if (!newState.weatherEffect && Math.random() < 0.2) {
    newState.weatherEffect = getRandomWeather();
    newState.battleLog.push(`The weather has changed to ${newState.weatherEffect.name}`);
  }

  return newState;
};