import { supabase } from '../lib/supabase';

const migrations = [
  `
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
  `,
  `
  CREATE TABLE IF NOT EXISTS public.players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    username TEXT UNIQUE NOT NULL,
    coins INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS public.player_teddies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES public.players(id),
    teddy_id UUID REFERENCES public.terrible_teddies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  `
];

export const runMigrations = async () => {
  console.log('Starting database migrations...');

  try {
    for (const [index, migration] of migrations.entries()) {
      console.log(`Executing migration ${index + 1}...`);
      const { error } = await supabase.rpc('run_sql_migration', { sql: migration });
      if (error) {
        console.error(`Migration ${index + 1} error:`, error);
        throw error;
      }
      console.log(`Migration ${index + 1} completed successfully`);
    }

    console.log('All migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database migration:', error);
    return false;
  }
};

export const verifyTables = async () => {
  try {
    const { data: terribleTeddies, error: teddiesError } = await supabase
      .from('terrible_teddies')
      .select('id')
      .limit(1);

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id')
      .limit(1);

    const { data: playerTeddies, error: playerTeddiesError } = await supabase
      .from('player_teddies')
      .select('id')
      .limit(1);

    if (teddiesError || playersError || playerTeddiesError) {
      console.error('Error verifying tables:', { teddiesError, playersError, playerTeddiesError });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying tables:', error);
    return false;
  }
};