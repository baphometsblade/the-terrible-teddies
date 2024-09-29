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
    // Create the migration function
    const { data: createFunctionData, error: createFunctionError } = await supabase.rpc('run_sql_migration', {
      sql: `
        CREATE OR REPLACE FUNCTION public.run_sql_migration(sql text)
        RETURNS void AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });

    if (createFunctionError) {
      console.error('Error creating migration function:', createFunctionError);
      return false;
    }

    // Run migrations
    for (const [index, migration] of migrations.entries()) {
      const { data, error } = await supabase.rpc('run_sql_migration', { sql: migration });
      if (error) {
        console.error(`Migration ${index + 1} error:`, error);
        return false;
      }
      console.log(`Executed migration ${index + 1}`);
    }

    console.log('Migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database migration:', error);
    return false;
  }
};