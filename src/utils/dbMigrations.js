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

  CREATE INDEX IF NOT EXISTS idx_terrible_teddies_name ON public.terrible_teddies(name);

  ALTER TABLE public.terrible_teddies ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Allow read access for all authenticated users" ON public.terrible_teddies
    FOR SELECT USING (auth.role() = 'authenticated');

  CREATE POLICY "Allow full access for admins" ON public.terrible_teddies
    USING (auth.jwt() ->> 'role' = 'admin');
  `
];

export const runMigrations = async () => {
  console.log('Starting database migrations...');

  try {
    for (const migration of migrations) {
      const { error } = await supabase.rpc('exec_sql', { sql: migration });
      if (error) throw error;
    }

    console.log('Migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database migration:', error.message);
    throw error;
  }
};