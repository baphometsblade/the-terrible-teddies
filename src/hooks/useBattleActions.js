import { useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { performPlayerAction } from '../utils/battleActions/playerActions';
import { performAIAction } from '../utils/battleActions/aiActions';
import { handlePowerUp } from '../utils/battleActions/powerUpActions';
import { handleCombo } from '../utils/battleActions/comboActions';

export const useBattleActions = (battleState, updateBattleState, playerTeddyData, opponentTeddyData, updatePlayerTeddyMutation) => {
  const { toast } = useToast();

  const performAction = useCallback((action) => {
    let newBattleState = performPlayerAction(action, battleState, playerTeddyData, opponentTeddyData, updatePlayerTeddyMutation, toast);
    updateBattleState(newBattleState);

    setTimeout(() => {
      const aiAction = AIOpponent.chooseAction(opponentTeddyData, playerTeddyData, newBattleState);
      newBattleState = performAIAction(aiAction, newBattleState, playerTeddyData, opponentTeddyData);
      updateBattleState(newBattleState);
    }, 1500);
  }, [battleState, playerTeddyData, opponentTeddyData, updateBattleState, updatePlayerTeddyMutation, toast]);

  const handlePowerUpAction = useCallback(() => {
    if (battleState.powerUpMeter === 100) {
      const newBattleState = handlePowerUp(battleState, playerTeddyData);
      updateBattleState(newBattleState);
    }
  }, [battleState, playerTeddyData, updateBattleState]);

  const handleComboAction = useCallback(() => {
    if (battleState.comboMeter === 100) {
      const newBattleState = handleCombo(battleState, playerTeddyData, opponentTeddyData);
      updateBattleState(newBattleState);
    }
  }, [battleState, playerTeddyData, opponentTeddyData, updateBattleState]);

  return { performAction, handlePowerUp: handlePowerUpAction, handleCombo: handleComboAction };
};