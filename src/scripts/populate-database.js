import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost', 'Support'];

const bearCards = [
  {
    name: "Cuddles McTrouble",
    type: "Action",
    energy_cost: 2,
    attack: 3,
    defense: 2,
    special_move: "Tickle Attack",
    description: "A mischievous bear with a penchant for tickle-based chaos.",
    image_url: "https://example.com/cuddles.jpg"
  },
  {
    name: "Sir Fluffsalot",
    type: "Defense",
    energy_cost: 3,
    attack: 1,
    defense: 5,
    special_move: "Fluff Shield",
    description: "A noble bear whose fluffy fur provides excellent protection.",
    image_url: "https://example.com/fluffsalot.jpg"
  },
  // Add more bear cards here...
];

const supportCards = [
  {
    name: "Honey Boost",
    type: "Support",
    energy_cost: 1,
    effect: "Increase a bear's attack by 2 for one turn.",
    description: "A jar of magical honey that temporarily enhances a bear's strength.",
    image_url: "https://example.com/honey_boost.jpg"
  },
  {
    name: "Teddy Repair Kit",
    type: "Support",
    energy_cost: 2,
    effect: "Restore 3 defense points to any bear on the field.",
    description: "A cute little sewing kit that can patch up any bear in a jiffy.",
    image_url: "https://example.com/repair_kit.jpg"
  },
  // Add more support cards here...
];

const populateDatabase = async () => {
  const allCards = [...bearCards, ...supportCards];

  const { data, error } = await supabase
    .from('terrible_teddies_cards')
    .insert(allCards);

  if (error) {
    console.error('Error inserting data:', error);
  } else {
    console.log('Successfully inserted', data.length, 'cards');
  }
};

populateDatabase()
  .then(() => console.log('Database population complete'))
  .catch(console.error);