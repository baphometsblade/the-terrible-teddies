import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  console.log('Starting database setup...');

  const migrations = [
    '001_initial_setup.sql',
    '002_create_player_teddies.sql',
    '003_create_terrible_teddies.sql',
    '004_create_player_teddies.sql',
    '005_create_player_teddies.sql',
    '006_create_shop_items.sql',
    '007_create_shop_items.sql',
    '008_create_players_table.sql'  // Add this new migration
  ];

  for (const migration of migrations) {
    const { error } = await supabase.rpc('run_sql_migration', {
      sql: (await import(`../db/migrations/${migration}`)).default
    });

    if (error) {
      console.error(`Error running migration ${migration}:`, error);
    } else {
      console.log(`Successfully ran migration ${migration}`);
    }
  }

  console.log('Database setup completed');
};

export const initializeDatabase = async () => {
  await setupDatabase();
};