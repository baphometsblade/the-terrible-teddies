export type Element = 'fire' | 'ice' | 'nature' | 'dark' | 'light' | 'cosmic' | 'chaos';

export interface TeddyCard {
  id: string;
  name: string;
  attack: number;
  defense: number;
  energyCost: number;
  specialAbility: SpecialAbility;
  image_url?: string;
  placeholderImage?: string;
  specialMove?: string;
  specialMoveDescription?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  element?: Element;
  level?: number;
  experience?: number;
}

export interface SpecialAbility {
  name: string;
  description: string;
  energyCost: number;
  cooldown: number;
  element?: Element;
}

export interface PowerUp {
  id: string;
  name: string;
  description: string;
  type: 'attack' | 'defense' | 'special' | 'ultimate';
  cost: number;
  duration: number;
  turnsRemaining?: number;
}

export interface BattleState {
  playerTeddy: TeddyCard;
  opponentTeddy: TeddyCard;
  playerHealth: number;
  opponentHealth: number;
  playerEnergy: number;
  opponentEnergy: number;
  currentTurn: 'player' | 'opponent';
  comboCount: number;
  currentCombo: string[];
  activeEffects: BattleEffect[];
  activePowerUps: PowerUp[];
  battleLog: string[];
  turnCount: number;
  elementalBonus: Element | null;
  weatherEffect?: string;
}

export interface BattleEffect {
  type: string;
  duration: number;
  value: number;
}

export interface ComboMove {
  name: string;
  moves: string[];
  effect: (state: BattleState) => BattleState;
}