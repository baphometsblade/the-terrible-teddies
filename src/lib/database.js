const Database = require("@replit/database");
const db = new Database();

export const initializeDatabase = async () => {
  try {
    console.log('Initializing Replit database...');
    await createTables();
    console.log('Replit database initialization successful');
    return true;
  } catch (error) {
    console.error('Error initializing Replit database:', error.message);
    throw new Error(`Failed to initialize Replit database: ${error.message}`);
  }
};

const createTables = async () => {
  // In Replit's key-value database, we don't create tables in the traditional sense.
  // Instead, we'll use prefixes to organize our data.
  console.log('Setting up data structure...');
  await db.set('terrible_teddies', []);
  await db.set('players', []);
  await db.set('battles', []);
};

export const getTeddies = async () => {
  return await db.get('terrible_teddies');
};

export const addTeddy = async (teddy) => {
  const teddies = await getTeddies();
  teddies.push(teddy);
  await db.set('terrible_teddies', teddies);
};

export const updateTeddy = async (updatedTeddy) => {
  const teddies = await getTeddies();
  const index = teddies.findIndex(t => t.id === updatedTeddy.id);
  if (index !== -1) {
    teddies[index] = updatedTeddy;
    await db.set('terrible_teddies', teddies);
  }
};

export const deleteTeddy = async (id) => {
  const teddies = await getTeddies();
  const updatedTeddies = teddies.filter(t => t.id !== id);
  await db.set('terrible_teddies', updatedTeddies);
};