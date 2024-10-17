import { TeddyCard } from '../types/types';

export const gainExperience = (teddy: TeddyCard, amount: number): TeddyCard => {
  const updatedTeddy = { ...teddy, experience: teddy.experience + amount };
  
  if (updatedTeddy.experience >= updatedTeddy.level * 100) {
    updatedTeddy.level += 1;
    updatedTeddy.experience -= (updatedTeddy.level - 1) * 100;
    updatedTeddy.attack += 1;
    updatedTeddy.defense += 1;
  }

  return updatedTeddy;
};