import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Parse from 'parse/node';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_API_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Back4App Parse
Parse.initialize(process.env.BACK4APP_APP_ID, process.env.BACK4APP_JS_KEY);
Parse.serverURL = 'https://parseapi.back4app.com/';

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

function parseBearData(data) {
  const bears = [];
  const lines = data.split('\n');
  let currentBear = {};

  for (const line of lines) {
    if (line.match(/^\d+\./)) {
      if (Object.keys(currentBear).length > 0) {
        bears.push(currentBear);
      }
      currentBear = {
        id: parseInt(line.match(/^\d+/)[0]),
        name: line.split('.')[1].trim(),
      };
    } else if (line.trim().startsWith('- Title:')) {
      currentBear.title = line.split(':')[1].trim();
    } else if (line.trim().startsWith('- Description:')) {
      currentBear.description = line.split(':')[1].trim();
    } else if (line.trim().startsWith('- Attack:')) {
      currentBear.attack = parseInt(line.split(':')[1].trim());
    } else if (line.trim().startsWith('- Defense:')) {
      currentBear.defense = parseInt(line.split(':')[1].trim());
    } else if (line.trim().startsWith('- Special Move:')) {
      const [moveName, moveDescription] = line.split(':')[1].split('-');
      currentBear.specialMove = moveName.trim();
      currentBear.specialMoveDescription = moveDescription.trim();
    }
  }

  if (Object.keys(currentBear).length > 0) {
    bears.push(currentBear);
  }

  return bears.map(bear => ({
    ...bear,
    type: CARD_TYPES[Math.floor(Math.random() * CARD_TYPES.length)],
    energy_cost: Math.floor(Math.random() * 5) + 1,
    imageUrl: `/placeholder.svg`,
  }));
}

function parseSupportCardData(data) {
  const supportCards = [];
  const lines = data.split('\n');
  let currentCard = {};

  for (const line of lines) {
    if (line.match(/^\d+\./)) {
      if (Object.keys(currentCard).length > 0) {
        supportCards.push(currentCard);
      }
      currentCard = {
        id: parseInt(line.match(/^\d+/)[0]),
        name: line.split('.')[1].trim(),
      };
    } else if (line.trim().startsWith('- Effect:')) {
      currentCard.effect = line.split(':')[1].trim();
    } else if (line.trim().startsWith('- Description:')) {
      currentCard.description = line.split(':')[1].trim();
    }
  }

  if (Object.keys(currentCard).length > 0) {
    supportCards.push(currentCard);
  }

  return supportCards.map(card => ({
    ...card,
    type: 'Support',
    energy_cost: Math.floor(Math.random() * 3) + 1,
    imageUrl: `/placeholder.svg`,
  }));
}

async function saveToSupabase(cards) {
  const { data, error } = await supabase
    .from('terrible_teddies_cards')
    .upsert(cards, { onConflict: 'id' });

  if (error) {
    console.error('Error saving to Supabase:', error);
  } else {
    console.log('Successfully saved to Supabase');
  }
}

async function saveToBack4App(cards) {
  const TerribleTeddyCard = Parse.Object.extend('TerribleTeddyCard');
  const savePromises = cards.map(card => {
    const newCard = new TerribleTeddyCard();
    return newCard.save(card);
  });

  try {
    await Promise.all(savePromises);
    console.log('Successfully saved to Back4App');
  } catch (error) {
    console.error('Error saving to Back4App:', error);
  }
}

async function migrateTeddyData() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const bearFileNames = ['terrible_teddies_bears_1_10.txt', 'terrible_teddies_bears_11_20.txt', 'terrible_teddies_bears_21_30.txt', 'terrible_teddies_bears_31_40.txt'];
  const supportCardFileName = 'terrible_teddies_support_cards.txt';
  
  let allCards = [];

  // Parse bear cards
  for (const fileName of bearFileNames) {
    const filePath = path.join(dataDir, fileName);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const parsedBears = parseBearData(fileContents);
    allCards = [...allCards, ...parsedBears];
  }

  // Parse support cards
  const supportCardPath = path.join(dataDir, supportCardFileName);
  const supportCardContents = fs.readFileSync(supportCardPath, 'utf8');
  const parsedSupportCards = parseSupportCardData(supportCardContents);
  allCards = [...allCards, ...parsedSupportCards];

  await saveToSupabase(allCards);
  await saveToBack4App(allCards);
}

migrateTeddyData().then(() => console.log('Migration complete'));