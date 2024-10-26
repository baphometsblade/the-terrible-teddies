export interface TeddyCard {
  id: string;
  name: string;
  title: string;
  description: string;
  attack: number;
  defense: number;
  energyCost: number;
  specialAbility: SpecialAbility;
  image_url: string;
}

export interface SpecialAbility {
  name: string;
  description: string;
  effect: (state: BattleState, card: TeddyCard) => Partial<BattleState>;
  energyCost: number;
  cooldown: number;
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
  moveHistory: string[];
  comboMeter: number;
  activeCombo: string[];
  comboProgress: number;
}

export interface Deck {
  id: string;
  name: string;
  cards: TeddyCard[];
}

export interface WeatherEffect {
  name: string;
  description: string;
  effect: (state: BattleState) => Partial<BattleState>;
  duration: number;
}