import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const cardTypes = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

const teddyData = [
  // ... (previous teddy data)
];

// Generate the remaining teddies to reach 40
for (let i = teddyData.length; i < 40; i++) {
  teddyData.push({
    name: `Teddy ${i + 1}`,
    type: cardTypes[Math.floor(Math.random() * cardTypes.length)],
    energy_cost: Math.floor(Math.random() * 5) + 1,
    attack: Math.floor(Math.random() * 5) + 1,
    defense: Math.floor(Math.random() * 5) + 1,
    special_move: `Special Move ${i + 1}`,
    description: `A unique teddy bear with special abilities.`,
  });
}

const populateDatabase = async () => {
  try {
    // Populate generated_images table
    const { data: cardData, error: cardError } = await supabase
      .from('generated_images')
      .upsert(teddyData.map(teddy => ({
        ...teddy,
        url: `https://picsum.photos/seed/${teddy.name}/200/300`,
        prompt: `A cute teddy bear for a ${teddy.type} card named ${teddy.name}`,
      })));

    if (cardError) throw cardError;
    console.log('Successfully inserted', cardData.length, 'cards into generated_images table');

    // Populate user_stats table
    const { error: userStatsError } = await supabase
      .from('user_stats')
      .upsert([
        { user_id: 'default_user', coins: 100, games_won: 0, games_played: 0, challenges_completed: 0 }
      ]);

    if (userStatsError && userStatsError.code !== '23505') throw userStatsError;
    console.log('Successfully inserted or updated default user in user_stats table');

    // Populate user_decks table
    const defaultDeck = teddyData.slice(0, 20).map(teddy => teddy.id);
    const { error: userDecksError } = await supabase
      .from('user_decks')
      .upsert([
        { user_id: 'default_user', cards: defaultDeck }
      ]);

    if (userDecksError && userDecksError.code !== '23505') throw userDecksError;
    console.log('Successfully inserted or updated default user deck in user_decks table');

    // Populate daily_challenges table
    const challenge = {
      date: new Date().toISOString().split('T')[0],
      description: "Win a game using only Action cards",
      reward: 100
    };

    const { error: challengeError } = await supabase
      .from('daily_challenges')
      .upsert([challenge]);

    if (challengeError && challengeError.code !== '23505') throw challengeError;
    console.log('Successfully inserted or updated daily challenge in daily_challenges table');

    // Populate games table
    const { error: gamesError } = await supabase
      .from('games')
      .insert([
        { host_id: 'default_user', status: 'waiting' }
      ]);

    if (gamesError) throw gamesError;
    console.log('Successfully inserted sample game into games table');

  } catch (error) {
    console.error('Error during database population:', error);
  }
};

populateDatabase()
  .then(() => console.log('Database population complete'))
  .catch(console.error);