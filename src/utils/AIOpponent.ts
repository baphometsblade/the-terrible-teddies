import { TeddyCard, BattleState } from '../types/types';

const evaluateGameState = (opponentTeddy: TeddyCard, playerTeddy: TeddyCard, battleState: BattleState): number => {
  const healthDifference = battleState.opponentHealth - battleState.playerHealth;
  const attackDifference = opponentTeddy.attack - playerTeddy.attack;
  const defenseDifference = opponentTeddy.defense - playerTeddy.defense;
  
  return healthDifference * 0.5 + attackDifference * 0.3 + defenseDifference * 0.2;
};

export const getAIAction = (opponentTeddy: TeddyCard, playerTeddy: TeddyCard, battleState: BattleState) => {
  const gameStateScore = evaluateGameState(opponentTeddy, playerTeddy, battleState);
  
  if (gameStateScore > 10) {
    return 'attack';
  } else if (gameStateScore < -10) {
    return 'defend';
  } else if (battleState.opponentEnergy >= 2 && Math.random() > 0.7) {
    return 'special';
  } else {
    const randomAction = Math.random();
    if (randomAction < 0.6) {
      return 'attack';
    } else if (randomAction < 0.9) {
      return 'defend';
    } else {
      return 'special';
    }
  }
};