import { checkForCombo, applyComboEffect } from '../battleUtils';

export const handleCombo = (battleState, playerTeddyData, opponentTeddyData) => {
  const combo = checkForCombo(battleState.moveHistory);
  if (combo) {
    const comboEffect = applyComboEffect(combo, playerTeddyData, opponentTeddyData);
    return {
      ...battleState,
      comboMeter: 0,
      battleLog: [...battleState.battleLog, `${playerTeddyData.name} unleashes ${combo.name} combo!`],
      ...comboEffect,
    };
  }
  return battleState;
};