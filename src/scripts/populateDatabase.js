import { initializeDatabase } from '../lib/database';

const populateDatabase = async () => {
  try {
    await initializeDatabase();
    console.log('Database populated successfully');
  } catch (error) {
    console.error('Error populating database:', error);
  }
};

populateDatabase();