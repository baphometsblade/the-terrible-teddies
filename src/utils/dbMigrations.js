import { supabase } from '../lib/supabase';
import fs from 'fs';
import path from 'path';

export const runMigrations = async () => {
  console.log('Starting database migrations...');

  try {
    const migrationsDir = path.join(__dirname, '../db/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`Running migration: ${file}`);
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) throw error;
    }

    console.log('Migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database migration:', error.message);
    throw error;
  }
};