import { supabase } from '../integrations/supabase';

export const setupDatabase = async () => {
  // Create the shop_cards table if it doesn't exist
  const { error: createTableError } = await supabase.rpc('create_shop_cards_table');

  if (createTableError) {
    console.error('Error creating shop_cards table:', createTableError);
    return;
  }

  // Check if the table is empty
  const { data: existingCards, error: checkError } = await supabase
    .from('shop_cards')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('Error checking shop_cards table:', checkError);
    return;
  }

  // If the table is empty, insert initial data
  if (existingCards.length === 0) {
    const { error: insertError } = await supabase
      .from('shop_cards')
      .insert([
        { name: 'Super Teddy', type: 'Action', price: 100, url: 'https://example.com/super_teddy.png' },
        { name: 'Fluffy Shield', type: 'Defense', price: 80, url: 'https://example.com/fluffy_shield.png' },
        { name: 'Cuddle Blast', type: 'Special', price: 120, url: 'https://example.com/cuddle_blast.png' },
        // Add more shop cards as needed
      ]);

    if (insertError) {
      console.error('Error inserting initial shop cards:', insertError);
    } else {
      console.log('Shop cards table set up successfully');
    }
  } else {
    console.log('Shop cards table already contains data');
  }
};
