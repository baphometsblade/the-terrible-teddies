import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const initSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('terrible_teddies')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error connecting to Supabase:', error.message);
      return false;
    }
    
    console.log('Successfully connected to Supabase');
    return true;
  } catch (error) {
    console.error('Unexpected error:', error.message);
    return false;
  }
};

export const setupTerribleTeddies = async () => {
  const { error } = await supabase.rpc('create_terrible_teddies_table');
  if (error) {
    console.error('Error creating terrible_teddies table:', error);
    return false;
  }
  console.log('terrible_teddies table created or already exists');
  return true;
};