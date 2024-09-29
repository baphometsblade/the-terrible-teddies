import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const initializeSupabase = async () => {
  try {
    console.log('Initializing Supabase...');
    const { data, error } = await supabase.from('terrible_teddies').select('count');
    if (error) throw error;
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Error initializing Supabase:', error.message);
    throw new Error(`Failed to initialize Supabase: ${error.message}`);
  }
};