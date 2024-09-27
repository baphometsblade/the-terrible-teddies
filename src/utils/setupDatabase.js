import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  const { error } = await supabase.rpc('create_terrible_teddies_table');
  if (error) {
    console.error('Error creating terrible_teddies table:', error);
  } else {
    console.log('terrible_teddies table created successfully');
  }
};