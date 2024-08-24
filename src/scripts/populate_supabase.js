import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const cardTypes = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

const generateCards = () => {
  return Array.from({ length: 40 }, (_, i) => ({
    name: `Teddy Card ${i + 1}`,
    url: `https://picsum.photos/seed/${i + 1}/200/300`,
    type: cardTypes[Math.floor(Math.random() * cardTypes.length)],
    prompt: `A cute teddy bear for a ${cardTypes[Math.floor(Math.random() * cardTypes.length)]} card`,
    energy_cost: Math.floor(Math.random() * 5) + 1,
  }));
};

const populateDatabase = async () => {
  const cards = generateCards();

  // Populate generated_images table
  const { data: cardData, error: cardError } = await supabase
    .from('generated_images')
    .insert(cards);

  if (cardError) {
    console.error('Error inserting card data:', cardError);
  } else {
    console.log('Successfully inserted', cardData.length, 'cards');
  }

  // Create and populate user_stats table
  const { error: tableError } = await supabase
    .from('user_stats')
    .insert([
      { user_id: 'default_user', coins: 100, games_won: 0, games_played: 0 }
    ]);

  if (tableError) {
    if (tableError.code === '42P07') {
      console.log('user_stats table already exists');
    } else {
      console.error('Error creating user_stats table:', tableError);
    }
  } else {
    console.log('Successfully created user_stats table and inserted default user');
  }
};

populateDatabase()
  .then(() => console.log('Database population complete'))
  .catch(console.error);