import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  console.log('Starting database setup...');

  // Create tables
  await createTables();

  // Populate initial data
  await populateInitialData();

  console.log('Database setup completed');
};

const createTables = async () => {
  const { error: terribleTeddiesError } = await supabase.rpc('run_sql_migration', {
    sql: `
      CREATE TABLE IF NOT EXISTS terrible_teddies (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        attack INTEGER NOT NULL,
        defense INTEGER NOT NULL,
        special_move TEXT NOT NULL,
        image_url TEXT
      );
    `
  });

  if (terribleTeddiesError) console.error('Error creating terrible_teddies table:', terribleTeddiesError);

  const { error: playersError } = await supabase.rpc('run_sql_migration', {
    sql: `
      CREATE TABLE IF NOT EXISTS players (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id),
        username TEXT UNIQUE NOT NULL,
        coins INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0
      );
    `
  });

  if (playersError) console.error('Error creating players table:', playersError);

  const { error: playerTeddiesError } = await supabase.rpc('run_sql_migration', {
    sql: `
      CREATE TABLE IF NOT EXISTS player_teddies (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        player_id UUID REFERENCES players(id),
        teddy_id UUID REFERENCES terrible_teddies(id)
      );
    `
  });

  if (playerTeddiesError) console.error('Error creating player_teddies table:', playerTeddiesError);
};

const populateInitialData = async () => {
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
    }
    // Add more initial teddies here
  ];

  const { error: insertError } = await supabase
    .from('terrible_teddies')
    .insert(initialTeddies);

  if (insertError) {
    console.error('Error populating terrible_teddies:', insertError);
  } else {
    console.log('Initial teddies populated successfully');
  }
};

export const initializeDatabase = async () => {
  await setupDatabase();
};