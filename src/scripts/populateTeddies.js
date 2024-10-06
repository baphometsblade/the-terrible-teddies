import { supabase } from '../lib/supabase';

const teddies = [
  {
    name: "Knight's Kiss",
    title: "The Chivalrous Charmer",
    description: "A romantic knight with a lance of love, leaving foes dazed by his charm.",
    attack: 7,
    defense: 6,
    special_move: "Rose Thrust",
    special_move_description: "A quick, romantic strike with his lance, leaving foes dazed by his charm."
  },
  {
    name: "Rocky Rumbler",
    title: "The Street Brawler",
    description: "A tough bear with brass knuckles and a penchant for bar fights.",
    attack: 8,
    defense: 4,
    special_move: "Bar Brawl",
    special_move_description: "Unleashes a flurry of brutal punches, fueled by a quick sip of his beer."
  },
  // ... Add all 50 teddies here
];

export const populateTeddies = async () => {
  console.log('Populating teddies...');
  for (const teddy of teddies) {
    const { data, error } = await supabase
      .from('terrible_teddies')
      .upsert(teddy, { onConflict: 'name' });

    if (error) {
      console.error(`Error inserting ${teddy.name}:`, error);
    } else {
      console.log(`Successfully inserted ${teddy.name}`);
    }
  }
  console.log('Finished populating teddies');
};