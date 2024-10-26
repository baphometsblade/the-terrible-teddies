import { BattleState, TeddyCard } from '../types/types';

export interface Combo {
  name: string;
  description: string;
  icon: string;
  requiredMoves: string[];
  effect: (state: BattleState, attacker: TeddyCard) => BattleState;
}

export const COMBOS: Record<string, Combo> = {
  'flame-flame-flame': {
    name: 'Inferno Chain',
    description: 'Triple fire damage and burns the opponent',
    icon: 'flame',
    requiredMoves: ['flame', 'flame', 'flame'],
    effect: (state, attacker) => ({
      ...state,
      opponentHealth: state.opponentHealth - Math.floor(attacker.attack * 2.5),
      opponentStatusEffects: [
        ...state.opponentStatusEffects,
        { type: 'burn', duration: 3, damage: 5 }
      ],
      battleLog: [...state.battleLog, `${attacker.name} unleashes Inferno Chain!`]
    })
  },
  'shield-shield-zap': {
    name: 'Counter Surge',
    description: 'Converts defense into lightning damage',
    icon: 'zap',
    requiredMoves: ['shield', 'shield', 'zap'],
    effect: (state, attacker) => ({
      ...state,
      opponentHealth: state.opponentHealth - (attacker.defense * 2),
      playerDefenseBoost: state.playerDefenseBoost + 5,
      battleLog: [...state.battleLog, `${attacker.name} performs Counter Surge!`]
    })
  },
  'zap-shield-flame': {
    name: 'Elemental Fusion',
    description: 'Combines elements for massive damage',
    icon: 'swords',
    requiredMoves: ['zap', 'shield', 'flame'],
    effect: (state, attacker) => ({
      ...state,
      opponentHealth: state.opponentHealth - Math.floor(attacker.attack * 3),
      playerEnergy: Math.min(state.playerEnergy + 2, 5),
      battleLog: [...state.battleLog, `${attacker.name} unleashes Elemental Fusion!`]
    })
  }
};

export const checkCombo = (moves: string[]): Combo | null => {
  const comboKey = moves.slice(-3).join('-');
  return COMBOS[comboKey] || null;
};

export const applyCombo = (state: BattleState, combo: Combo, attacker: TeddyCard): BattleState => {
  const newState = combo.effect(state, attacker);
  return {
    ...newState,
    moveHistory: [],
    comboMeter: 0,
    battleLog: [
      ...newState.battleLog,
      `Combo chain reset!`
    ]
  };
};

export const updateComboProgress = (moves: string[]): number => {
  const possibleCombos = Object.values(COMBOS);
  const maxProgress = possibleCombos.reduce((max, combo) => {
    const progress = calculateComboProgress(moves, combo.requiredMoves);
    return Math.max(max, progress);
  }, 0);
  return maxProgress;
};

const calculateComboProgress = (currentMoves: string[], requiredMoves: string[]): number => {
  const matchingMoves = currentMoves.slice(-requiredMoves.length);
  const matches = matchingMoves.reduce((count, move, index) => {
    return count + (move === requiredMoves[index] ? 1 : 0);
  }, 0);
  return (matches / requiredMoves.length) * 100;
};