import { applyPowerUp } from '../battleUtils';

export const handlePowerUp = (battleState, playerTeddyData) => {
  const powerUp = applyPowerUp(playerTeddyData);
  return {
    ...battleState,
    powerUpMeter: 0,
    battleLog: [...battleState.battleLog, `${playerTeddyData.name} activates ${powerUp.name}!`],
    ...powerUp.effect,
  };
};