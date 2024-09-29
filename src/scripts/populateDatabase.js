import { initializeDatabase } from '../lib/database';

const setupDatabase = async () => {
  try {
    await initializeDatabase();
    console.log('Database structure set up successfully');
  } catch (error) {
    console.error('Error setting up database structure:', error);
  }
};

setupDatabase();