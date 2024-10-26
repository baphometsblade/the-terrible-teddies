import { useState, useCallback } from 'react';
import { TeddyCard, BattleState, Element } from '../types/types';
import { toast } from "@/components/ui/use-toast";

export const useBattleState = (initialPlayerTeddy: TeddyCard, initialOpponentTeddy: TeddyCard) => {
  const [battleState, setBattleState] = useState<BattleState>({
    playerTeddy: initialPlayerTeddy,
    opponentTeddy: initialOpponentTeddy,
    playerHealth: 30,
    opponentHealth: 30,
    playerEnergy: 3,
    opponentEnergy: 3,
    currentTurn: 'player',
    comboCount: 0,
    currentCombo: [],
    activeEffects: [],
    battleLog: [],
    turnCount: 1,
    elementalBonus: null,
  });

  const applyDamage = useCallback((damage: number, target: 'player' | 'opponent', source: Element) => {
    setBattleState(prev => {
      const elementalMultiplier = getElementalMultiplier(source, target === 'player' ? prev.playerTeddy.element : prev.opponentTeddy.element);
      const finalDamage = Math.round(damage * elementalMultiplier);

      if (elementalMultiplier > 1) {
        toast({
          title: "Super Effective!",
          description: `${source} is super effective against ${target === 'player' ? prev.playerTeddy.element : prev.opponentTeddy.element}!`,
          variant: "success",
        });
      }

      return {
        ...prev,
        [target === 'player' ? 'playerHealth' : 'opponentHealth']: Math.max(
          0,
          target === 'player' ? prev.playerHealth - finalDamage : prev.opponentHealth - finalDamage
        ),
        battleLog: [...prev.battleLog, `Dealt ${finalDamage} ${source} damage to ${target}!`]
      };
    });
  }, []);

  const addToCombo = useCallback((move: string) => {
    setBattleState(prev => ({
      ...prev,
      comboCount: prev.comboCount + 1,
      currentCombo: [...prev.currentCombo, move].slice(-3)
    }));
  }, []);

  const resetCombo = useCallback(() => {
    setBattleState(prev => ({
      ...prev,
      comboCount: 0,
      currentCombo: []
    }));
  }, []);

  const addEffect = useCallback((effect: { type: string; duration: number; value: number }) => {
    setBattleState(prev => ({
      ...prev,
      activeEffects: [...prev.activeEffects, effect]
    }));
  }, []);

  return {
    battleState,
    applyDamage,
    addToCombo,
    resetCombo,
    addEffect,
    setBattleState
  };
};

const getElementalMultiplier = (attackElement: Element, defendElement: Element): number => {
  const elementalChart: Record<Element, Element[]> = {
    fire: ['nature', 'ice'],
    ice: ['nature', 'cosmic'],
    nature: ['dark', 'light'],
    dark: ['light', 'chaos'],
    light: ['dark', 'cosmic'],
    cosmic: ['chaos', 'fire'],
    chaos: ['cosmic', 'ice']
  };

  if (!attackElement || !defendElement) return 1;
  if (elementalChart[attackElement].includes(defendElement)) return 1.5;
  if (elementalChart[defendElement].includes(attackElement)) return 0.75;
  return 1;
};