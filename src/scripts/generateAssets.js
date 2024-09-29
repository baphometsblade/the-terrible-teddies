import { generateAllAssets } from '../utils/assetGenerator';

const generateAssets = async () => {
  console.log('Starting asset generation...');
  const assets = await generateAllAssets();
  console.log(`Generated ${assets.length} assets`);
  console.log('Asset generation complete');
};

generateAssets();