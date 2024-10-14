import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const setupTerribleTeddies = async () => {
  try {
    // Create the table if it doesn't exist
    const { error: createError } = await supabase.rpc('run_sql_migration', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.terrible_teddies (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          name TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          attack INTEGER NOT NULL,
          defense INTEGER NOT NULL,
          special_move TEXT NOT NULL,
          image_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (createError) {
      console.error('Error creating terrible_teddies table:', createError);
      return false;
    }

    // Check if the table is empty
    const { count, error: countError } = await supabase
      .from('terrible_teddies')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error checking terrible_teddies table:', countError);
      return false;
    }

    // If the table is empty, populate it
    if (count === 0) {
      return populateTerribleTeddies();
    }

    console.log('terrible_teddies table is already set up and populated');
    return true;
  } catch (error) {
    console.error('Unexpected error in setupTerribleTeddies:', error);
    return false;
  }
};

const populateTerribleTeddies = async () => {
  try {
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

    const { error } = await supabase
      .from('terrible_teddies')
      .insert(initialTeddies);

    if (error) {
      console.error('Error populating terrible_teddies:', error);
      return false;
    }

    console.log('Terrible Teddies populated successfully');
    return true;
  } catch (error) {
    console.error('Unexpected error in populateTerribleTeddies:', error);
    return false;
  }
};

// Function to create the terrible_teddies table
export const createTerribleTeddiesTable = async () => {
  try {
    const { error } = await supabase.rpc('create_terrible_teddies_table');
    if (error) {
      console.error('Error creating terrible_teddies table:', error);
      return false;
    }
    console.log('create_terrible_teddies_table function executed successfully');
    return true;
  } catch (error) {
    console.error('Error executing create_terrible_teddies_table function:', error);
    return false;
  }
};