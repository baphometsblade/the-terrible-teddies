import { supabase } from '../lib/supabase';
import { generateTeddyImage, saveTeddyImage } from './imageGenerator';

export const generateTeddyBear = async () => {
  const names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Icy Ivan", "Lady Lush"];
  const titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Frosty Fighter", "The Party Animal"];
  const specialMoves = ["On the Rocks", "Sneak Kiss", "Burst Bubble", "Ice Age", "Drunken Master"];

  const randomIndex = Math.floor(Math.random() * names.length);
  const name = names[randomIndex];
  const title = titles[randomIndex];
  const specialMove = specialMoves[randomIndex];
  const description = `A cheeky teddy with a knack for ${specialMove.toLowerCase()}.`;

  const imageUrl = await generateTeddyImage(name, description);
  const savedImageUrl = await saveTeddyImage(name, imageUrl);

  return {
    name,
    title,
    description,
    attack: Math.floor(Math.random() * 3) + 4, // 4-6
    defense: Math.floor(Math.random() * 3) + 4, // 4-6
    special_move: specialMove,
    image_url: savedImageUrl
  };
};