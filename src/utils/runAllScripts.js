import { setupDatabase } from './setupDatabase';
import { populateDatabase } from './populateDatabase';
import { uploadTeddyImages } from './imageUpload';
import { generateGameAssets } from './generateGameAssets';

export const runAllScripts = async () => {
  try {
    console.log('Starting to run all scripts...');
    
    await setupDatabase();
    console.log('Database setup complete');
    
    await populateDatabase();
    console.log('Database population complete');
    
    await uploadTeddyImages();
    console.log('Teddy images uploaded');
    
    await generateGameAssets((progress) => {
      console.log(`Generating game assets: ${progress}% complete`);
    });
    console.log('Game asset generation complete');
    
    console.log('All scripts executed successfully');
    return 'All scripts executed successfully';
  } catch (error) {
    console.error('Error running scripts:', error);
    return `Error: ${error.message}`;
  }
};