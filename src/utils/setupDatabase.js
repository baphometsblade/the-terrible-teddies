import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  console.log('Setting up database...');

  const migrations = [
    {
      name: 'create_player_teddies_table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.player_teddies (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          player_id UUID NOT NULL,
          teddy_id UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE
        );

        -- Add an index for faster queries
        CREATE INDEX IF NOT EXISTS idx_player_teddies_player_id ON public.player_teddies(player_id);

        -- Enable Row Level Security (RLS)
        ALTER TABLE public.player_teddies ENABLE ROW LEVEL SECURITY;

        -- Create a policy to allow users to see only their own teddies
        CREATE POLICY "Users can view own teddies" ON public.player_teddies
          FOR SELECT USING (auth.uid() = player_id);

        -- Create a policy to allow users to insert their own teddies
        CREATE POLICY "Users can insert own teddies" ON public.player_teddies
          FOR INSERT WITH CHECK (auth.uid() = player_id);

        -- Create a policy to allow users to update their own teddies
        CREATE POLICY "Users can update own teddies" ON public.player_teddies
          FOR UPDATE USING (auth.uid() = player_id);

        -- Create a policy to allow users to delete their own teddies
        CREATE POLICY "Users can delete own teddies" ON public.player_teddies
          FOR DELETE USING (auth.uid() = player_id);
      `
    },
    // Add more migrations here if needed
  ];

  for (const migration of migrations) {
    try {
      console.log(`Running migration: ${migration.name}`);
      const { error } = await supabase.rpc('run_sql_migration', { sql: migration.sql });
      if (error) throw error;
      console.log(`Migration ${migration.name} completed successfully`);
    } catch (error) {
      console.error(`Error in migration ${migration.name}:`, error);
      throw error; // Re-throw the error to stop the setup process
    }
  }

  console.log('Database setup completed');
};