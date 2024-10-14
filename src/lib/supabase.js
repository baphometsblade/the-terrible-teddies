import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const setupTerribleTeddies = async () => {
  try {
    console.log('Fetching Terrible Teddies from Supabase...');
    const { data, error } = await supabase
      .from('terrible_teddies')
      .select('*');

    if (error) {
      console.error('Error fetching Terrible Teddies:', error);
      return false;
    }

    if (data && data.length > 0) {
      console.log(`Successfully fetched ${data.length} Terrible Teddies`);
      return true;
    } else {
      console.log('No Terrible Teddies found in the database');
      return false;
    }
  } catch (error) {
    console.error('Unexpected error in setupTerribleTeddies:', error);
    return false;
  }
};
