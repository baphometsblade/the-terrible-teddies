import { TeddyCard } from '../types/types';
import { supabase } from '../lib/supabase';

export const upgradeTeddy = async (teddy: TeddyCard, wave: number) => {
  const upgradedTeddy = {
    ...teddy,
    attack: teddy.attack + Math.floor(wave * 0.5),
    defense: teddy.defense + Math.floor(wave * 0.3),
    level: (teddy.level || 1) + 1,
  };

  try {
    const { data, error } = await supabase
      .from('terrible_teddies')
      .update(upgradedTeddy)
      .eq('id', teddy.id);

    if (error) throw error;
    return upgradedTeddy;
  } catch (error) {
    console.error('Error upgrading teddy:', error);
    return teddy;
  }
};

export const calculateExperience = (wave: number, performance: number): number => {
  const baseXP = wave * 100;
  const performanceMultiplier = Math.max(0.5, Math.min(2, performance / 100));
  return Math.floor(baseXP * performanceMultiplier);
};

export const checkLevelUp = (teddy: TeddyCard): boolean => {
  const experienceThreshold = Math.pow(teddy.level || 1, 1.5) * 1000;
  return (teddy.experience || 0) >= experienceThreshold;
};