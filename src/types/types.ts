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
  element?: 'fire' | 'ice' | 'nature' | 'dark' | 'light';
}

export interface SpecialAbility {
  name: string;
  energyCost: number;
  description: string;
}

export interface BattleState {
  playerHealth: number;
  opponentHealth: number;
  playerEnergy: number;
  opponentEnergy: number;
  playerField: TeddyCard[];
  opponentField: TeddyCard[];
  playerHand: TeddyCard[];
  opponentHand: TeddyCard[];
  currentTurn: 'player' | 'opponent';
  battleLog: string[];
  playerCooldowns: Record<string, number>;
  opponentCooldowns: Record<string, number>;
  weatherEffect: WeatherEffect | null;
  turnCount: number;
  playerStunned: boolean;
  opponentStunned: boolean;
}

export interface WeatherEffect {
  name: string;
  description: string;
  duration: number;
}
