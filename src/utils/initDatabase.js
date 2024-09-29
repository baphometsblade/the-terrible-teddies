import { supabase } from '../lib/supabase';

export const initDatabase = async () => {
  // Create terrible_teddies table
  const { error: teddiesError } = await supabase.rpc('create_table_if_not_exists', {
    table_name: 'terrible_teddies',
    table_definition: `
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      attack INTEGER NOT NULL,
      defense INTEGER NOT NULL,
      special_move TEXT NOT NULL,
      image_url TEXT
    `
  });
  if (teddiesError) console.error('Error creating terrible_teddies table:', teddiesError);

  // Create players table
  const { error: playersError } = await supabase.rpc('create_table_if_not_exists', {
    table_name: 'players',
    table_definition: `
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id),
      username TEXT UNIQUE NOT NULL,
      coins INTEGER DEFAULT 0
    `
  });
  if (playersError) console.error('Error creating players table:', playersError);

  // Create player_teddies table
  const { error: playerTeddiesError } = await supabase.rpc('create_table_if_not_exists', {
    table_name: 'player_teddies',
    table_definition: `
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      player_id UUID REFERENCES players(id),
      teddy_id UUID REFERENCES terrible_teddies(id)
    `
  });
  if (playerTeddiesError) console.error('Error creating player_teddies table:', playerTeddiesError);

  console.log('Database initialization complete');
};