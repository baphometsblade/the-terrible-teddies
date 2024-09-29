import { supabase } from '../lib/supabase';

export const runMigrations = async () => {
  console.log('Starting database migrations...');

  try {
    // Create the terrible_teddies table
    const { error: teddiesError } = await supabase.from('terrible_teddies').insert({
      id: 'dummy',
      name: 'Dummy Bear',
      title: 'The Placeholder',
      description: 'This is a dummy bear to ensure the table exists.',
      attack: 0,
      defense: 0,
      special_move: 'None',
      image_url: null,
    }).select();

    if (teddiesError && !teddiesError.message.includes('duplicate key value')) {
      throw teddiesError;
    }

    // Remove the dummy data
    await supabase.from('terrible_teddies').delete().eq('id', 'dummy');

    console.log('Migrations completed successfully');
    return true;
  } catch (error) {
    console.error('Error during database migration:', error.message);
    throw error;
  }
};