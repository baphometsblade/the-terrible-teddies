import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const cardTypes = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

const teddyData = [
  {
    name: "Cuddles McTrouble",
    type: "Action",
    energy_cost: 2,
    attack: 3,
    defense: 2,
    special_move: "Tickle Attack",
    description: "A mischievous bear with a penchant for tickle-based chaos.",
  },
  {
    name: "Sir Fluffsalot",
    type: "Defense",
    energy_cost: 3,
    attack: 1,
    defense: 5,
    special_move: "Fluff Shield",
    description: "A noble bear whose fluffy fur provides excellent protection.",
  },
  {
    name: "Sneaky Paws",
    type: "Trap",
    energy_cost: 1,
    attack: 2,
    defense: 1,
    special_move: "Honey Trap",
    description: "A cunning bear that lays sweet and sticky traps for opponents.",
  },
  {
    name: "Captain Grizzles",
    type: "Action",
    energy_cost: 3,
    attack: 4,
    defense: 3,
    special_move: "Bear Hug",
    description: "A brave teddy bear captain with a crushing embrace.",
  },
  {
    name: "Mystic Moonbeam",
    type: "Special",
    energy_cost: 4,
    attack: 3,
    defense: 3,
    special_move: "Starlight Serenade",
    description: "A mystical bear with the power to harness cosmic energy.",
  },
  {
    name: "Sergeant Snuggles",
    type: "Defense",
    energy_cost: 2,
    attack: 1,
    defense: 4,
    special_move: "Plush Barricade",
    description: "A tactical teddy expert in defensive maneuvers.",
  },
  {
    name: "Ninja Bearnana",
    type: "Action",
    energy_cost: 2,
    attack: 4,
    defense: 1,
    special_move: "Shadow Claw",
    description: "A stealthy bear trained in the art of surprise attacks.",
  },
  {
    name: "Professor Honeypot",
    type: "Boost",
    energy_cost: 3,
    attack: 2,
    defense: 2,
    special_move: "Intellect Surge",
    description: "A scholarly bear with the ability to boost allies' intelligence.",
  },
  {
    name: "Disco Teddy",
    type: "Special",
    energy_cost: 3,
    attack: 3,
    defense: 2,
    special_move: "Groovy Waves",
    description: "A funky bear that can stun opponents with sick dance moves.",
  },
  {
    name: "Beary Potter",
    type: "Special",
    energy_cost: 4,
    attack: 3,
    defense: 3,
    special_move: "Ursine Spell",
    description: "A magical bear skilled in casting powerful bear-themed spells.",
  },
  // Add more teddy data here to reach 40 unique teddies
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
  // Populate generated_images table
  const { data: cardData, error: cardError } = await supabase
    .from('generated_images')
    .insert(teddyData.map(teddy => ({
      ...teddy,
      url: `https://picsum.photos/seed/${teddy.name}/200/300`, // Placeholder image URL
      prompt: `A cute teddy bear for a ${teddy.type} card named ${teddy.name}`,
    })));

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
  const defaultDeck = teddyData.slice(0, 20).map((_, index) => index + 1); // Use first 20 cards as default deck
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

  // Create and populate games table
  const { error: gamesError } = await supabase
    .from('games')
    .insert([
      { host_id: 'default_user', status: 'waiting' }
    ]);

  if (gamesError) {
    console.error('Error inserting into games table:', gamesError);
  } else {
    console.log('Successfully inserted sample game into games table');
  }
};

populateDatabase()
  .then(() => console.log('Database population complete'))
  .catch(console.error);