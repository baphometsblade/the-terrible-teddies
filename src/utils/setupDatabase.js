import { supabase } from '../lib/supabase';
import fs from 'fs';
import path from 'path';

export const setupDatabase = async () => {
  console.log('Starting database setup...');

  // Run migrations
  await runMigrations();

  // Populate initial data
  await populateInitialData();

  console.log('Database setup completed');
};

const runMigrations = async () => {
  const migrationFiles = fs.readdirSync(path.join(__dirname, '../db/migrations'))
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const migrationContent = fs.readFileSync(path.join(__dirname, '../db/migrations', file), 'utf8');
    const { error } = await supabase.rpc('run_sql_migration', { sql: migrationContent });
    if (error) {
      console.error(`Error running migration ${file}:`, error);
      throw error;
    }
    console.log(`Migration ${file} completed successfully`);
  }
};

const populateInitialData = async () => {
  // Populate terrible_teddies table if it's empty
  const { data: existingTeddies, error: checkError } = await supabase
    .from('terrible_teddies')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('Error checking existing teddies:', checkError);
    return;
  }

  if (!existingTeddies || existingTeddies.length === 0) {
    const initialTeddies = [
      {
        name: "Whiskey Whiskers",
        title: "The Smooth Operator",
        description: "A suave bear with a penchant for fine spirits and even finer company.",
        attack: 6,
        defense: 5,
        special_move: "On the Rocks",
        image_url: "https://example.com/whiskey_whiskers.png"
      },
      {
        name: "Madame Mistletoe",
        title: "The Festive Flirt",
        description: "She carries mistletoe year-round, believing every moment is an opportunity for a sly kiss.",
        attack: 5,
        defense: 6,
        special_move: "Sneak Kiss",
        image_url: "https://example.com/madame_mistletoe.png"
      }
      // Add more initial teddies here
    ];

    const { error: insertError } = await supabase
      .from('terrible_teddies')
      .insert(initialTeddies);

    if (insertError) {
      console.error('Error populating terrible_teddies:', insertError);
    } else {
      console.log('Initial teddies populated successfully');
    }
  } else {
    console.log('Terrible teddies table already contains data');
  }
};

export const initializeDatabase = async () => {
  await setupDatabase();
};