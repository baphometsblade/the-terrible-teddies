import { supabase } from '../integrations/supabase';

export const setupDatabase = async () => {
  const { error } = await supabase
    .from('shop_cards')
    .insert([
      { name: 'Super Teddy', type: 'Action', price: 100, url: 'https://example.com/super_teddy.png' },
      { name: 'Fluffy Shield', type: 'Defense', price: 80, url: 'https://example.com/fluffy_shield.png' },
      { name: 'Cuddle Blast', type: 'Special', price: 120, url: 'https://example.com/cuddle_blast.png' },
      // Add more shop cards as needed
    ]);

  if (error) {
    console.error('Error setting up shop_cards table:', error);
  } else {
    console.log('Shop cards table set up successfully');
  }
};