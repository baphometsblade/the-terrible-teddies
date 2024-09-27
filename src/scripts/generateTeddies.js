import { generateAllTeddyBears } from '../utils/teddyGenerator';

const generateTeddies = async () => {
  console.log('Starting teddy generation...');
  const teddies = await generateAllTeddyBears();
  console.log(`Generated ${teddies.length} teddies`);
};

generateTeddies();