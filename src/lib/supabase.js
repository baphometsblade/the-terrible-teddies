import { createClient } from '@supabase/supabase-js';
import { runMigrations, verifyTables } from '../utils/dbMigrations';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const initializeSupabase = async () => {
  try {
    console.log('Initializing Supabase...');
    await runMigrations();
    const tablesVerified = await verifyTables();
    if (!tablesVerified) {
      throw new Error('Failed to verify database tables');
    }
    console.log('Supabase initialization successful');
    return true;
  } catch (error) {
    console.error('Error initializing Supabase:', error.message);
    throw new Error(`Failed to initialize Supabase: ${error.message}`);
  }
};