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
  effect: (state: BattleState) => Partial<BattleState>;
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  requiredCards: string[];
}

export interface BattleState {
  playerTeddy: TeddyCard;
  opponentTeddy: TeddyCard;
  playerHealth: number;
  opponentHealth: number;
  playerEnergy: number;
  opponentEnergy: number;
  playerDefenseBoost: number;
  opponentDefenseBoost: number;
  currentTurn: 'player' | 'opponent';
  weatherEffect: WeatherEffect;
  availablePowerUps: PowerUp[];
  battleLog: string[];
  playerAttackBoost: number;
  playerAttackBoostDuration: number;
  opponentAttackBoost: number;
  opponentAttackBoostDuration: number;
}

export interface WeatherEffect {
  name: string;
  description: string;
  effect: (damage: number) => number;
}