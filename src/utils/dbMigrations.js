import { supabase } from '../lib/supabase';

export const runMigrations = async () => {
  const migrationFiles = [
    '001_create_player_teddies.sql',
  ];

  for (const file of migrationFiles) {
    const { data, error } = await supabase.storage
      .from('migrations')
      .download(file);

    if (error) {
      console.error(`Error downloading migration file ${file}:`, error);
      continue;
    }

    const sqlContent = await data.text();

    const { error: executionError } = await supabase.rpc('run_sql', {
      sql: sqlContent
    });

    if (executionError) {
      console.error(`Error executing migration ${file}:`, executionError);
    } else {
      console.log(`Successfully executed migration ${file}`);
    }
  }
};