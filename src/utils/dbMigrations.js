import { supabase } from '../lib/supabase';

export const runMigrations = async () => {
  console.log('Starting database migrations...');

  try {
    const { data, error } = await supabase.rpc('run_migrations');
    if (error) throw error;
    console.log('Migrations completed successfully:', data);
    return true;
  } catch (error) {
    console.error('Error during database migration:', error.message);
    throw error;
  }
};

const createPlayerTeddiesTable = async () => {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.player_teddies (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      player_id UUID NOT NULL,
      teddy_id UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_player_teddies_player_id ON public.player_teddies(player_id);

    ALTER TABLE public.player_teddies ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own teddies" ON public.player_teddies
      FOR SELECT USING (auth.uid() = player_id);

    CREATE POLICY "Users can insert own teddies" ON public.player_teddies
      FOR INSERT WITH CHECK (auth.uid() = player_id);

    CREATE POLICY "Users can update own teddies" ON public.player_teddies
      FOR UPDATE USING (auth.uid() = player_id);

    CREATE POLICY "Users can delete own teddies" ON public.player_teddies
      FOR DELETE USING (auth.uid() = player_id);
  `;

  const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
  if (error) throw new Error(`Error creating player_teddies table: ${error.message}`);
  console.log('player_teddies table created successfully');
};