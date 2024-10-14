import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const initialTeddies = [
  {
    name: "Whiskey Whiskers",
    title: "The Smooth Operator",
    description: "A suave bear with a penchant for fine spirits and even finer company.",
    attack: 6,
    defense: 5,
    special_move: "On the Rocks",
    image_url: "https://example.com/whiskey_whiskers.png"
  },
  {
    name: "Madame Mistletoe",
    title: "The Festive Flirt",
    description: "She carries mistletoe year-round, believing every moment is an opportunity for a sly kiss.",
    attack: 5,
    defense: 6,
    special_move: "Sneak Kiss",
    image_url: "https://example.com/madame_mistletoe.png"
  },
  {
    name: "Baron Von Blubber",
    title: "The Inflated Ego",
    description: "A pompous bear with an oversized monocle and a belly that's one puff away from popping.",
    attack: 7,
    defense: 4,
    special_move: "Burst Bubble",
    image_url: "https://example.com/baron_von_blubber.png"
  },
  {
    name: "Icy Ivan",
    title: "The Frosty Fighter",
    description: "A bear with fur as white as snow and eyes as cold as ice. He's wearing nothing but a tiny Speedo.",
    attack: 6,
    defense: 7,
    special_move: "Ice Age",
    image_url: "https://example.com/icy_ivan.png"
  },
  {
    name: "Lady Lush",
    title: "The Party Animal",
    description: "This bear's fur is a mess of glitter and confetti. She's always ready for a good time.",
    attack: 5,
    defense: 5,
    special_move: "Drunken Master",
    image_url: "https://example.com/lady_lush.png"
  }
];

const populateTerribleTeddies = async () => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .insert(initialTeddies);

  if (error) {
    console.error('Error populating terrible_teddies:', error);
    return false;
  }

  console.log('Terrible Teddies populated successfully');
  return true;
};

export const setupTerribleTeddies = async () => {
  try {
    console.log('Fetching Terrible Teddies from Supabase...');
    const { data, error } = await supabase
      .from('terrible_teddies')
      .select('*');

    if (error) {
      console.error('Error fetching Terrible Teddies:', error);
      return false;
    }

    if (data && data.length > 0) {
      console.log(`Successfully fetched ${data.length} Terrible Teddies`);
      return true;
    } else {
      console.log('No Terrible Teddies found in the database. Populating...');
      return await populateTerribleTeddies();
    }
  } catch (error) {
    console.error('Unexpected error in setupTerribleTeddies:', error);
    return false;
  }
};