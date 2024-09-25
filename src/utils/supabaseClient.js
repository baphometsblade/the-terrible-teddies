import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchTeddyBears() {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('*');
  
  if (error) {
    console.error('Error fetching teddy bears:', error);
    return [];
  }
  
  return data;
}