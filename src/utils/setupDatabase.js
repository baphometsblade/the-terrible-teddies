import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  const { error } = await supabase.rpc('create_players_table');
  if (error) {
    console.error('Error creating players table:', error);
  } else {
    console.log('Players table created successfully');
  }
};

// Call this function when your app initializes
// setupDatabase();