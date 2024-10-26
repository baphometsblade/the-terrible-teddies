import { useState, useEffect } from 'react';
import { BattleState, TeddyCard } from '../types/types';
import { checkCombo, applyCombo, updateComboProgress, COMBOS } from '../utils/comboSystem';
import { useToast } from "@/components/ui/use-toast";

export const useComboSystem = (
  battleState: BattleState,
  updateBattleState: (state: BattleState) => void,
  playerTeddy: TeddyCard
) => {
  const [lastMove, setLastMove] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (lastMove) {
      const newMoveHistory = [...battleState.moveHistory, lastMove];
      const combo = checkCombo(newMoveHistory);
      const progress = updateComboProgress(newMoveHistory);

      if (combo) {
        const newState = applyCombo(battleState, combo, playerTeddy);
        updateBattleState(newState);
        toast({
          title: "Combo Activated!",
          description: `${combo.name} dealt massive damage!`,
          variant: "success",
        });
      } else {
        updateBattleState({
          ...battleState,
          moveHistory: newMoveHistory,
          comboProgress: progress,
        });
      }
      setLastMove(null);
    }
  }, [lastMove, battleState, updateBattleState, playerTeddy, toast]);

  const addMove = (moveType: string) => {
    setLastMove(moveType);
  };

  const getAvailableCombos = () => COMBOS;

  return {
    addMove,
    getAvailableCombos,
    comboProgress: battleState.comboProgress,
    activeCombo: battleState.moveHistory,
  };
};