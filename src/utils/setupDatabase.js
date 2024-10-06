import { supabase } from '../lib/supabase';
import { generateMockTeddies, generateMockShopItems } from './mockDataGenerator';
import { populateTeddies } from '../scripts/populateTeddies';

export const setupDatabase = async () => {
  try {
    // Create tables if they don't exist
    await createTables();

    // Populate tables with new teddies
    await populateTeddies();

    // Populate tables with mock data (if needed)
    await populateMockData();

    console.log('Database setup and data population complete');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
};

const createTables = async () => {
  const { error: teddiesError } = await supabase.rpc('create_table_if_not_exists', {
    table_name: 'terrible_teddies',
    table_definition: `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      attack INTEGER NOT NULL,
      defense INTEGER NOT NULL,
      special_move TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `
  });
  if (teddiesError) console.error('Error creating terrible_teddies table:', teddiesError);

  const { error: playersError } = await supabase.rpc('create_table_if_not_exists', {
    table_name: 'players',
    table_definition: `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users(id),
      username TEXT UNIQUE NOT NULL,
      coins INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      rank TEXT DEFAULT 'Novice',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `
  });
  if (playersError) console.error('Error creating players table:', playersError);

  const { error: playerTeddiesError } = await supabase.rpc('create_table_if_not_exists', {
    table_name: 'player_teddies',
    table_definition: `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id UUID REFERENCES players(id),
      teddy_id UUID REFERENCES terrible_teddies(id),
      level INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `
  });
  if (playerTeddiesError) console.error('Error creating player_teddies table:', playerTeddiesError);

  const { error: shopError } = await supabase.rpc('create_table_if_not_exists', {
    table_name: 'shop_items',
    table_definition: `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      type TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `
  });
  if (shopError) console.error('Error creating shop_items table:', shopError);
};

const populateMockData = async () => {
  const mockTeddies = generateMockTeddies();
  const { error: teddiesError } = await supabase
    .from('terrible_teddies')
    .upsert(mockTeddies, { onConflict: 'name' });
  if (teddiesError) console.error('Error populating terrible_teddies:', teddiesError);

  const mockShopItems = generateMockShopItems();
  const { error: shopError } = await supabase
    .from('shop_items')
    .upsert(mockShopItems, { onConflict: 'name' });
  if (shopError) console.error('Error populating shop_items:', shopError);
};