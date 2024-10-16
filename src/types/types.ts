export interface TeddyCard {
  id: number;
  name: string;
  attack: number;
  defense: number;
  specialAbility: {
    name: string;
    effect: string;
  };
  abilityDuration?: number;
}

export interface PowerUp {
  id: string;
  name: string;
  description: string;
  effect: () => void;
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  requiredCards: string[];
}