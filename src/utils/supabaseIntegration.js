import { supabase } from '../lib/supabase';

export const integrateSupabaseData = async (assets) => {
  try {
    // Insert generated assets into the terrible_teddies table
    const { data, error } = await supabase
      .from('terrible_teddies')
      .upsert(assets, { onConflict: 'name' });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error integrating assets with Supabase:', error);
    throw error;
  }
};