import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const setupTerribleTeddies = async () => {
  const { data, error } = await supabase
    .from('terrible_teddies')
    .select('count')
    .single();

  if (error) {
    console.error('Error checking terrible_teddies table:', error);
    return false;
  }

  if (data.count === 0) {
    return populateTerribleTeddies();
  }

  return true;
};

const populateTerribleTeddies = async () => {
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
};