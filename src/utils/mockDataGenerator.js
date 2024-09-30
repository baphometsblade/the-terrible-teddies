import { v4 as uuidv4 } from 'uuid';

const generateMockTeddies = (count = 50) => {
  const teddies = [];
  const titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Frosty Fighter", "The Party Animal"];
  const specialMoves = ["On the Rocks", "Sneak Kiss", "Burst Bubble", "Ice Age", "Drunken Master"];

  for (let i = 0; i < count; i++) {
    teddies.push({
      id: uuidv4(),
      name: `Teddy ${i + 1}`,
      title: titles[Math.floor(Math.random() * titles.length)],
      description: `A cheeky teddy with a knack for mischief.`,
      attack: Math.floor(Math.random() * 5) + 3,
      defense: Math.floor(Math.random() * 5) + 3,
      special_move: specialMoves[Math.floor(Math.random() * specialMoves.length)],
      image_url: `https://example.com/teddy${i + 1}.png`,
    });
  }

  return teddies;
};

const generateMockShopItems = (count = 10) => {
  const items = [];
  const types = ["pack", "cosmetic", "consumable"];

  for (let i = 0; i < count; i++) {
    items.push({
      id: uuidv4(),
      name: `Item ${i + 1}`,
      description: `A fantastic item for your teddies!`,
      price: Math.floor(Math.random() * 500) + 100,
      type: types[Math.floor(Math.random() * types.length)],
      image_url: `https://example.com/item${i + 1}.png`,
    });
  }

  return items;
};

export { generateMockTeddies, generateMockShopItems };