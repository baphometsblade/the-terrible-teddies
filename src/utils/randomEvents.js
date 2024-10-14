import { supabase } from '../lib/supabase';

const events = [
  {
    type: 'coinBonus',
    description: 'You found a treasure chest! Gain extra coins.',
    effect: (player) => ({ ...player, coins: player.coins + 50 }),
  },
  {
    type: 'statBoost',
    description: 'Your teddy ate a magic berry! Temporary stat boost.',
    effect: (teddy) => ({ ...teddy, attack: teddy.attack + 2, defense: teddy.defense + 2 }),
  },
  {
    type: 'enemyWeakness',
    description: 'Your opponent seems distracted. They might be weaker in the next battle.',
    effect: (opponent) => ({ ...opponent, defense: Math.max(1, opponent.defense - 1) }),
  },
  {
    type: 'mysteriousStranger',
    description: 'A mysterious stranger offers to trade teddies with you.',
    effect: async (player) => {
      const { data: newTeddy, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .order('RANDOM()')
        .limit(1)
        .single();
      
      if (error) throw error;
      
      return { ...player, newTeddy };
    },
  },
];

export const generateRandomEvent = async () => {
  const event = events[Math.floor(Math.random() * events.length)];
  return event;
};

export const applyRandomEvent = async (event, target) => {
  if (typeof event.effect === 'function') {
    return await event.effect(target);
  }
  return target;
};