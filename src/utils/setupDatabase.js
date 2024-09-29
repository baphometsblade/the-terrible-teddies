import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  console.log('Starting database setup...');

  const migrations = [
    '001_create_tables.sql',
    '002_create_functions.sql',
    '003_create_policies.sql'
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