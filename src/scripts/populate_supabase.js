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
    attack: Math.floor(Math.random() * 10) + 1,
    defense: Math.floor(Math.random() * 10) + 1,
    special_move: `Special Move ${i + 1}`,
    description: `This is a description for Teddy Card ${i + 1}`,
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
    console.log('Successfully inserted', cardData.length, 'cards into generated_images table');
  }

  // Create and populate user_stats table
  const { error: userStatsError } = await supabase
    .from('user_stats')
    .insert([
      { user_id: 'default_user', coins: 100, games_won: 0, games_played: 0, challenges_completed: 0 }
    ]);

  if (userStatsError) {
    if (userStatsError.code === '23505') { // unique_violation error code
      console.log('Default user already exists in user_stats table');
    } else {
      console.error('Error inserting into user_stats table:', userStatsError);
    }
  } else {
    console.log('Successfully inserted default user into user_stats table');
  }

  // Create and populate user_decks table
  const defaultDeck = cards.slice(0, 20).map(card => card.id); // Use first 20 cards as default deck
  const { error: userDecksError } = await supabase
    .from('user_decks')
    .insert([
      { user_id: 'default_user', cards: defaultDeck }
    ]);

  if (userDecksError) {
    if (userDecksError.code === '23505') { // unique_violation error code
      console.log('Default user deck already exists in user_decks table');
    } else {
      console.error('Error inserting into user_decks table:', userDecksError);
    }
  } else {
    console.log('Successfully inserted default user deck into user_decks table');
  }

  // Create and populate daily_challenges table
  const challenge = {
    date: new Date().toISOString().split('T')[0],
    description: "Win a game using only Action cards",
    reward: 100
  };

  const { error: challengeError } = await supabase
    .from('daily_challenges')
    .insert([challenge]);

  if (challengeError) {
    if (challengeError.code === '23505') { // unique_violation error code
      console.log('Daily challenge for today already exists in daily_challenges table');
    } else {
      console.error('Error inserting into daily_challenges table:', challengeError);
    }
  } else {
    console.log('Successfully inserted daily challenge into daily_challenges table');
  }
};

populateDatabase()
  .then(() => console.log('Database population complete'))
  .catch(console.error);