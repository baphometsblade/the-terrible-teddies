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