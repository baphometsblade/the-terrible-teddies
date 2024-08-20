import fs from 'fs';
import path from 'path';

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

export default function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const dataDir = path.join(process.cwd(), 'public', 'data');
      const fileNames = ['terrible_teddies_bears_1_10.txt', 'terrible_teddies_bears_11_20.txt', 'terrible_teddies_bears_21_30.txt', 'terrible_teddies_bears_31_40.txt'];
      
      let allBears = [];

      for (const fileName of fileNames) {
        const filePath = path.join(dataDir, fileName);
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const parsedBears = parseBearData(fileContents);
        allBears = [...allBears, ...parsedBears];
      }

      res.status(200).json(allBears);
    } catch (error) {
      console.error('Error reading bear data:', error);
      res.status(500).json({ error: 'Failed to load bear data' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}