export interface TeddyCard {
  id: string;
  name: string;
  title: string;
  description: string;
  attack: number;
  defense: number;
  special_move: string;
  image_url: string;
  created_at?: string;
}

export interface PowerUp {
  id: string;
  name: string;
  description: string;
  effect: (state: BattleState) => BattleState;
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  requiredCards: string[];
}

export interface BattleState {
  playerHealth: number;
  opponentHealth: number;
  playerEnergy: number;
  opponentEnergy: number;
  playerDefenseBoost: number;
  opponentDefenseBoost: number;
  playerStatusEffects: StatusEffect[];
  opponentStatusEffects: StatusEffect[];
  currentTurn: 'player' | 'opponent';
  roundCount: number;
  playerExperience: number;
  playerLevel: number;
  weatherEffect: WeatherEffect;
  comboMeter: number;
  powerUpMeter: number;
  battleLog: string[];
  moveHistory: string[];
  playerItems: BattleItem[];
  opponentItems: BattleItem[];
  playerAttackBoost: number;
  playerAttackBoostDuration: number;
  opponentAttackBoost: number;
  opponentAttackBoostDuration: number;
  playerShield: boolean;
  opponentShield: boolean;
  rage: number;
  aiRage: number;
  playerCriticalChanceBoost: number;
  opponentCriticalChanceBoost: number;
}

export interface StatusEffect {
  name: string;
  duration: number;
  effect: (state: BattleState, target: 'player' | 'opponent') => BattleState;
}

export interface WeatherEffect {
  name: string;
  description: string;
  effect: (state: BattleState) => BattleState;
}

export interface BattleItem {
  name: string;
  description: string;
  effect: (state: BattleState, isPlayer: boolean) => BattleState;
}
