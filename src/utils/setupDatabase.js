import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  console.log('Starting database setup...');

  const migrations = [
    '001_create_tables.sql',
    '002_create_functions.sql',
    '003_create_policies.sql',
    '013_create_player_teddies_table.sql',
    '014_create_player_teddies_table.sql',
    '015_create_player_teddies_table.sql'  // Add this line
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