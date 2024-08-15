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
  }));
};

const populateDatabase = async () => {
  const cards = generateCards();

  const { data, error } = await supabase
    .from('generated_images')
    .insert(cards);

  if (error) {
    console.error('Error inserting data:', error);
  } else {
    console.log('Successfully inserted', data.length, 'cards');
  }
};

populateDatabase()
  .then(() => console.log('Database population complete'))
  .catch(console.error);