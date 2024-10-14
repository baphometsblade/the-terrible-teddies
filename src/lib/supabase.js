import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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

const createTerribleTeddiesTable = async () => {
  try {
    const { data, error } = await supabase.rpc('create_terrible_teddies_table');
    if (error) throw error;
    console.log('Table creation result:', data);
    return data;
  } catch (error) {
    console.error('Error creating terrible_teddies table:', error);
    throw error;
  }
};

const populateTerribleTeddies = async () => {
  try {
    const { data, error } = await supabase
      .from('terrible_teddies')
      .upsert(initialTeddies, { onConflict: 'name' });

    if (error) throw error;

    console.log('Terrible Teddies populated successfully');
    return true;
  } catch (error) {
    console.error('Error populating terrible_teddies:', error);
    throw error;
  }
};

export const setupTerribleTeddies = async () => {
  try {
    console.log('Setting up Terrible Teddies...');
    
    const tableExists = await checkTableExists();
    if (!tableExists) {
      const tableCreated = await createTerribleTeddiesTable();
      if (!tableCreated) {
        throw new Error('Failed to create terrible_teddies table');
      }
    }

    const { count, error } = await supabase
      .from('terrible_teddies')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count === 0) {
      console.log('Terrible Teddies table is empty. Populating...');
      await populateTerribleTeddies();
    } else {
      console.log(`Terrible Teddies table contains ${count} records`);
    }

    return true;
  } catch (error) {
    console.error('Error in setupTerribleTeddies:', error);
    throw error;
  }
};

export const checkTableExists = async () => {
  try {
    const { data, error } = await supabase
      .from('terrible_teddies')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('Terrible Teddies table does not exist');
        return false;
      }
      throw error;
    }

    console.log('Terrible Teddies table exists');
    return true;
  } catch (error) {
    console.error('Unexpected error checking table existence:', error);
    throw error;
  }
};
