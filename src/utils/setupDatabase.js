import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  console.log('Starting database setup...');

  const { error } = await supabase.rpc('run_sql_migration', {
    sql: `
      CREATE TABLE IF NOT EXISTS public.player_teddies (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        player_id UUID NOT NULL,
        teddy_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE,
        FOREIGN KEY (teddy_id) REFERENCES public.terrible_teddies(id) ON DELETE CASCADE
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
    `
  });

  if (error) {
    console.error('Error setting up database:', error);
  } else {
    console.log('Database setup completed successfully');
  }
};

export const initializeDatabase = async () => {
  await setupDatabase();
};