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
    await createTables();
    await setupPolicies();
    await insertInitialData();
    console.log('Supabase initialization successful');
    return true;
  } catch (error) {
    console.error('Error initializing Supabase:', error.message);
    throw new Error(`Failed to initialize Supabase: ${error.message}`);
  }
};

const createTables = async () => {
  const tables = [
    {
      name: 'terrible_teddies',
      columns: `
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        attack INTEGER NOT NULL,
        defense INTEGER NOT NULL,
        special_move TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `
    },
    {
      name: 'players',
      columns: `
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id),
        username TEXT UNIQUE NOT NULL,
        coins INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `
    },
    {
      name: 'player_teddies',
      columns: `
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        player_id UUID REFERENCES players(id),
        teddy_id UUID REFERENCES terrible_teddies(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `
    },
    {
      name: 'battles',
      columns: `
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        player1_id UUID REFERENCES players(id),
        player2_id UUID REFERENCES players(id),
        winner_id UUID REFERENCES players(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `
    },
    {
      name: 'player_submissions',
      columns: `
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        player_id UUID REFERENCES players(id),
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        attack INTEGER NOT NULL,
        defense INTEGER NOT NULL,
        special_move TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `
    }
  ];

  for (const table of tables) {
    const { error } = await supabase.rpc('create_table_if_not_exists', {
      table_name: table.name,
      table_definition: table.columns
    });
    if (error) throw new Error(`Error creating ${table.name} table: ${error.message}`);
  }
};

const setupPolicies = async () => {
  const policies = [
    {
      table: 'terrible_teddies',
      name: 'Allow read access for all authenticated users',
      definition: `CREATE POLICY "Allow read access for all authenticated users" ON terrible_teddies FOR SELECT USING (auth.role() = 'authenticated')`
    },
    {
      table: 'players',
      name: 'Allow users to read own data',
      definition: `CREATE POLICY "Allow users to read own data" ON players FOR SELECT USING (auth.uid() = user_id)`
    },
    {
      table: 'player_teddies',
      name: 'Allow users to read own teddies',
      definition: `CREATE POLICY "Allow users to read own teddies" ON player_teddies FOR SELECT USING (auth.uid() = (SELECT user_id FROM players WHERE id = player_id))`
    },
    {
      table: 'battles',
      name: 'Allow users to read own battles',
      definition: `CREATE POLICY "Allow users to read own battles" ON battles FOR SELECT USING (auth.uid() IN (SELECT user_id FROM players WHERE id IN (player1_id, player2_id)))`
    },
    {
      table: 'player_submissions',
      name: 'Allow users to read own submissions',
      definition: `CREATE POLICY "Allow users to read own submissions" ON player_submissions FOR SELECT USING (auth.uid() = (SELECT user_id FROM players WHERE id = player_id))`
    }
  ];

  for (const policy of policies) {
    const { error } = await supabase.rpc('create_policy_if_not_exists', {
      table_name: policy.table,
      policy_name: policy.name,
      policy_definition: policy.definition
    });
    if (error) throw new Error(`Error creating policy for ${policy.table}: ${error.message}`);
  }
};

const insertInitialData = async () => {
  const { data: existingTeddies, error: checkError } = await supabase
    .from('terrible_teddies')
    .select('id')
    .limit(1);

  if (checkError) throw new Error(`Error checking terrible_teddies table: ${checkError.message}`);

  if (existingTeddies.length === 0) {
    const initialTeddies = [
      {
        name: "Whiskey Whiskers",
        title: "The Smooth Operator",
        description: "A suave bear with a penchant for fine spirits and even finer company.",
        attack: 6,
        defense: 5,
        special_move: "On the Rocks",
        image_url: null
      },
      {
        name: "Madame Mistletoe",
        title: "The Festive Flirt",
        description: "Always ready with a sly wink and a sprig of mistletoe.",
        attack: 5,
        defense: 6,
        special_move: "Sneak Kiss",
        image_url: null
      }
    ];

    const { error: insertError } = await supabase
      .from('terrible_teddies')
      .insert(initialTeddies);

    if (insertError) throw new Error(`Error inserting initial teddies: ${insertError.message}`);
  }
};