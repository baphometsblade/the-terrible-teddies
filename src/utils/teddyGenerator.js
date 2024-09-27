import { supabase } from '../lib/supabase';

const generateTeddyBear = async () => {
  const names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Bella Bombshell", "Professor Playful"];
  const titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Dynamite Diva", "The Teasing Tutor"];
  const specialMoves = ["On the Rocks", "Sneak Kiss", "Burst Bubble", "Heart Stopper", "Mind Game"];

  const randomIndex = Math.floor(Math.random() * names.length);
  const name = names[randomIndex];
  const title = titles[randomIndex];
  const specialMove = specialMoves[randomIndex];

  return {
    name,
    title,
    description: `A cheeky teddy with a knack for ${specialMove.toLowerCase()}.`,
    attack: Math.floor(Math.random() * 3) + 4, // 4-6
    defense: Math.floor(Math.random() * 3) + 4, // 4-6
    specialMove,
    imageUrl: 'https://via.placeholder.com/150' // Placeholder image URL
  };
};

export const generateTeddyBears = async (count) => {
  const bears = [];
  for (let i = 0; i < count; i++) {
    const bear = await generateTeddyBear();
    bears.push(bear);

    try {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .insert([bear]);

      if (error) {
        console.error('Error storing bear:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error generating or storing bear:', error);
      throw error;
    }
  }
  return bears;
};