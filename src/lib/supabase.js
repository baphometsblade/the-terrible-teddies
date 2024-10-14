import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const setupTerribleTeddies = async () => {
  try {
    // Ensure the function exists
    await createTerribleTeddiesTable();

    // Check if the table exists and has data
    const { data, error } = await supabase
      .from('terrible_teddies')
      .select('count')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking terrible_teddies table:', error);
      return false;
    }

    // If the table is empty or doesn't exist, populate it
    if (!data || data.count === 0) {
      return populateTerribleTeddies();
    }

    console.log('terrible_teddies table is already set up and populated');
    return true;
  } catch (error) {
    console.error('Unexpected error in setupTerribleTeddies:', error);
    return false;
  }
};

const populateTerribleTeddies = async () => {
  try {
    const { data: teddyCards } = await import('../data/teddyCards.js');
    
    const teddies = teddyCards.map(card => ({
      name: card.name,
      title: card.type,
      description: `A ${card.type} card with ${card.effect} effect`,
      attack: card.effect === 'damage' ? card.value : 0,
      defense: card.effect === 'defense' ? card.value : 0,
      special_move: card.name,
      image_url: `https://example.com/${card.name.toLowerCase().replace(/\s+/g, '-')}.png`
    }));

    const { error } = await supabase
      .from('terrible_teddies')
      .insert(teddies);

    if (error) {
      console.error('Error populating terrible_teddies:', error);
      return false;
    }

    console.log('Terrible Teddies populated successfully');
    return true;
  } catch (error) {
    console.error('Unexpected error in populateTerribleTeddies:', error);
    return false;
  }
};

// Function to create the terrible_teddies table
export const createTerribleTeddiesTable = async () => {
  try {
    const { error } = await supabase.rpc('create_terrible_teddies_table');
    if (error) {
      console.error('Error creating terrible_teddies table:', error);
      return false;
    }
    console.log('create_terrible_teddies_table function executed successfully');
    return true;
  } catch (error) {
    console.error('Error executing create_terrible_teddies_table function:', error);
    return false;
  }
};