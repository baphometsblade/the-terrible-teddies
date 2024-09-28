import { supabase } from '../lib/supabase';

const challenges = [
  { description: "Win 3 battles in a row", reward_coins: 50 },
  { description: "Use a special move 5 times", reward_coins: 30 },
  { description: "Collect 3 new teddy bears", reward_coins: 75 },
  { description: "Reach a 5-win streak", reward_coins: 100 },
  { description: "Upgrade a teddy bear to max level", reward_coins: 150 },
];

export const generateDailyChallenge = async () => {
  const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
  
  const { data, error } = await supabase
    .from('daily_challenges')
    .insert([randomChallenge])
    .select();

  if (error) {
    console.error('Error generating daily challenge:', error);
    return null;
  }

  return data[0];
};