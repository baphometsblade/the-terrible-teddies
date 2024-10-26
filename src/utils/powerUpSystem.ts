import { TeddyCard, BattleState } from '../types/types';

export interface PowerUp {
  id: string;
  name: string;
  description: string;
  type: 'attack' | 'defense' | 'special' | 'ultimate';
  cost: number;
  duration: number;
  effect: (state: BattleState, teddy: TeddyCard) => Partial<BattleState>;
}

export const powerUps: PowerUp[] = [
  {
    id: 'rage',
    name: 'Teddy Rage',
    description: 'Double attack power for 2 turns',
    type: 'attack',
    cost: 3,
    duration: 2,
    effect: (state, teddy) => ({
      playerTeddy: { ...teddy, attack: teddy.attack * 2 }
    })
  },
  {
    id: 'shield',
    name: 'Stuffing Shield',
    description: 'Increase defense by 50% for 2 turns',
    type: 'defense',
    cost: 2,
    duration: 2,
    effect: (state, teddy) => ({
      playerTeddy: { ...teddy, defense: Math.floor(teddy.defense * 1.5) }
    })
  },
  {
    id: 'heal',
    name: 'Cotton Candy Heal',
    description: 'Restore 5 HP instantly',
    type: 'special',
    cost: 4,
    duration: 1,
    effect: (state) => ({
      playerHealth: Math.min(30, state.playerHealth + 5)
    })
  },
  {
    id: 'ultimate',
    name: 'Teddy Apocalypse',
    description: 'Deal massive damage to opponent',
    type: 'ultimate',
    cost: 8,
    duration: 1,
    effect: (state) => ({
      opponentHealth: Math.max(0, state.opponentHealth - 15)
    })
  }
];

export const activatePowerUp = (
  powerUp: PowerUp,
  state: BattleState,
  teddy: TeddyCard
): BattleState => {
  const effects = powerUp.effect(state, teddy);
  return {
    ...state,
    ...effects,
    playerEnergy: state.playerEnergy - powerUp.cost,
    activePowerUps: [
      ...state.activePowerUps,
      { ...powerUp, turnsRemaining: powerUp.duration }
    ],
    battleLog: [
      ...state.battleLog,
      `${teddy.name} activated ${powerUp.name}!`
    ]
  };
};

export const updatePowerUps = (state: BattleState): BattleState => {
  const updatedPowerUps = state.activePowerUps
    .map(powerUp => ({
      ...powerUp,
      turnsRemaining: powerUp.turnsRemaining - 1
    }))
    .filter(powerUp => powerUp.turnsRemaining > 0);

  return {
    ...state,
    activePowerUps: updatedPowerUps
  };
};