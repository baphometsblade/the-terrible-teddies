import { supabase } from '../lib/supabase';
import fs from 'fs';
import path from 'path';

export const runMigrations = async () => {
  console.log('Starting database migrations...');

  try {
    const migrationDir = path.join(__dirname, '../db/migrations');
    const migrationFiles = fs.readdirSync(migrationDir).sort();

    for (const file of migrationFiles) {
      const filePath = path.join(migrationDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      const { error } = await supabase.rpc('run_sql_migration', { sql });
      if (error) throw new Error(`Migration error in ${file}: ${error.message}`);

      console.log(`Executed migration: ${file}`);
    }

    console.log('Migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database migration:', error.message);
    throw error;
  }
};