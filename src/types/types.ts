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
  effect: (state: BattleState) => Partial<BattleState>;
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
}

export interface Deck {
  id: string;
  name: string;
  cards: TeddyCard[];
}
