import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const teddyBears = [
  { name: "Whiskey Whiskers", title: "The Smooth Operator" },
  { name: "Madame Mistletoe", title: "The Festive Flirt" },
  // ... add all 50 teddy bears here
];

const generatePrompt = (bear) => {
  return `Create a hyper-realistic, ultra-detailed image of a mischievous teddy bear named "${bear.name}" (${bear.title}) for the adult card game "Terrible Teddies". The bear should embody cheeky, tongue-in-cheek humor with a hint of naughtiness. Make it visually striking and slightly provocative, suitable for an adult audience. Ensure the bear's expression and pose reflect its title and personality. The image should be high resolution with intricate details of the bear's fur, accessories, and surroundings that match its character.`;
};

export async function generateGameAssets(onProgress) {
  const generatedAssets = [];

  for (let i = 0; i < teddyBears.length; i++) {
    const bear = teddyBears[i];
    try {
      const response = await openai.images.generate({
        prompt: generatePrompt(bear),
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response.data[0].url;
      const { data, error } = await supabase.storage
        .from('teddy-images')
        .upload(`${bear.name.replace(/\s+/g, '-').toLowerCase()}.png`, await (await fetch(imageUrl)).blob(), {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('teddy-images')
        .getPublicUrl(data.path).data.publicUrl;

      const assetData = {
        name: bear.name,
        title: bear.title,
        url: publicUrl,
        attack: Math.floor(Math.random() * 3) + 5, // Random attack between 5-7
        defense: Math.floor(Math.random() * 3) + 4, // Random defense between 4-6
        special_move: `${bear.name}'s Special Move`, // Placeholder, replace with actual special moves
        special_move_description: `Description of ${bear.name}'s special move` // Placeholder, replace with actual descriptions
      };

      generatedAssets.push(assetData);
      if (onProgress) {
        onProgress(((i + 1) / teddyBears.length) * 100);
      }
      console.log(`Generated asset for ${bear.name}`);
    } catch (error) {
      console.error(`Error generating image for ${bear.name}:`, error);
    }
  }

  // Save all generated assets to Supabase
  const { data, error } = await supabase
    .from('terrible_teddies')
    .insert(generatedAssets);

  if (error) {
    console.error('Error inserting generated assets:', error);
    throw error;
  } else {
    console.log('All assets generated and inserted successfully');
  }

  return generatedAssets;
}
