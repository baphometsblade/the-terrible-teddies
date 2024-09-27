import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const generateTeddyBear = async () => {
  const names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Bella Bombshell", "Professor Playful"];
  const titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Dynamite Diva", "The Teasing Tutor"];
  const specialMoves = ["On the Rocks", "Sneak Kiss", "Burst Bubble", "Heart Stopper", "Mind Game"];

  const randomIndex = Math.floor(Math.random() * names.length);
  const name = names[randomIndex];
  const title = titles[randomIndex];
  const specialMove = specialMoves[randomIndex];

  const prompt = `Create a hyper-realistic, ultra-detailed image of a mischievous teddy bear named "${name}" (${title}) for the adult card game "Terrible Teddies". The bear should embody cheeky, tongue-in-cheek humor with a hint of naughtiness. Make it visually striking and slightly provocative, suitable for an adult audience. Ensure the bear's expression and pose reflect its title and personality. The image should be high resolution with intricate details of the bear's fur, accessories, and surroundings that match its character.`;

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  });

  const imageUrl = response.data[0].url;

  return {
    name,
    title,
    description: `A cheeky teddy with a knack for ${specialMove.toLowerCase()}.`,
    attack: Math.floor(Math.random() * 3) + 4, // 4-6
    defense: Math.floor(Math.random() * 3) + 4, // 4-6
    specialMove,
    imageUrl
  };
};

export const generateAllAssets = async (count = 50) => {
  const generatedAssets = [];
  for (let i = 0; i < count; i++) {
    const bear = await generateTeddyBear();
    generatedAssets.push(bear);

    // Store the bear data in Supabase
    const { data, error } = await supabase
      .from('terrible_teddies')
      .insert([bear]);

    if (error) {
      console.error('Error storing bear data:', error);
    }

    // Store the image in Supabase Storage
    const { data: imageData, error: imageError } = await supabase.storage
      .from('teddy-images')
      .upload(`${bear.name.replace(/\s+/g, '-').toLowerCase()}.png`, await (await fetch(bear.imageUrl)).blob(), {
        contentType: 'image/png',
      });

    if (imageError) {
      console.error('Error storing bear image:', imageError);
    }
  }
  return generatedAssets;
};