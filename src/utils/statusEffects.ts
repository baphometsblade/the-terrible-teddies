import { BattleState, TeddyCard } from '../types/types';

export type StatusEffect = {
  name: string;
  duration: number;
  effect: (state: BattleState, target: 'player' | 'opponent') => BattleState;
};

const statusEffects: Record<string, StatusEffect> = {
  burn: {
    name: 'Burn',
    duration: 3,
    effect: (state, target) => {
      const damage = 5;
      const healthKey = target === 'player' ? 'playerHealth' : 'opponentHealth';
      return {
        ...state,
        [healthKey]: Math.max(0, state[healthKey] - damage),
        battleLog: [...state.battleLog, `${target === 'player' ? 'Player' : 'Opponent'} takes ${damage} burn damage!`],
      };
    },
  },
  stun: {
    name: 'Stun',
    duration: 1,
    effect: (state, target) => ({
      ...state,
      [target === 'player' ? 'playerStunned' : 'opponentStunned']: true,
      battleLog: [...state.battleLog, `${target === 'player' ? 'Player' : 'Opponent'} is stunned and loses their turn!`],
    }),
  },
};

export const applyStatusEffects = (state: BattleState): BattleState => {
  let newState = { ...state };

  ['player', 'opponent'].forEach((target) => {
    const effectsKey = target === 'player' ? 'playerStatusEffects' : 'opponentStatusEffects';
    newState[effectsKey] = newState[effectsKey].map((effect) => {
      newState = statusEffects[effect.name].effect(newState, target as 'player' | 'opponent');
      return { ...effect, duration: effect.duration - 1 };
    }).filter((effect) => effect.duration > 0);
  });

  return newState;
};

export const addStatusEffect = (state: BattleState, effectName: string, target: 'player' | 'opponent'): BattleState => {
  const effectsKey = target === 'player' ? 'playerStatusEffects' : 'opponentStatusEffects';
  const newEffect = { ...statusEffects[effectName] };
  return {
    ...state,
    [effectsKey]: [...state[effectsKey], newEffect],
    battleLog: [...state.battleLog, `${target === 'player' ? 'Player' : 'Opponent'} is afflicted with ${newEffect.name}!`],
  };
};