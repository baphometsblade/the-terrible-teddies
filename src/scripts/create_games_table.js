import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const createGamesTable = async () => {
  const { error } = await supabase.rpc('create_games_table');

  if (error) {
    console.error('Error creating games table:', error);
  } else {
    console.log('Games table created successfully');
  }
};

createGamesTable()
  .then(() => console.log('Migration complete'))
  .catch(console.error);