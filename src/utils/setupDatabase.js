import { supabase } from '../lib/supabase';
import fs from 'fs';
import path from 'path';

export const setupDatabase = async () => {
  const migrationFiles = [
    '001_initial_setup.sql',
    '002_create_player_teddies.sql',
    '003_create_terrible_teddies.sql',
    '004_create_player_teddies.sql'
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, '..', 'db', 'migrations', file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    const { error } = await supabase.rpc('run_sql_migration', { sql });
    if (error) {
      console.error(`Error running migration ${file}:`, error);
    } else {
      console.log(`Migration ${file} completed successfully`);
    }
  }

  console.log('Database setup completed');
};