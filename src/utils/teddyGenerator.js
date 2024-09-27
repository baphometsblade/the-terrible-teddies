import { v4 as uuidv4 } from 'uuid';
import { generateTeddyImage } from './imageGenerator';

const generateTeddyBear = async () => {
  const names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Bella Bombshell", "Professor Playful"];
  const titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Dynamite Diva", "The Teasing Tutor"];
  const specialMoves = ["On the Rocks", "Sneak Kiss", "Burst Bubble", "Heart Stopper", "Mind Game"];

  const randomIndex = Math.floor(Math.random() * names.length);
  const name = names[randomIndex];
  const title = titles[randomIndex];
  const specialMove = specialMoves[randomIndex];
  const description = `A cheeky teddy with a knack for ${specialMove.toLowerCase()}.`;

  const imageUrl = await generateTeddyImage(name, description);

  return {
    id: uuidv4(),
    name,
    title,
    description,
    attack: Math.floor(Math.random() * 3) + 4, // 4-6
    defense: Math.floor(Math.random() * 3) + 4, // 4-6
    specialMove,
    imageUrl
  };
};

export const generateTeddyBears = async (count) => {
  const bears = [];
  for (let i = 0; i < count; i++) {
    bears.push(await generateTeddyBear());
  }
  return bears;
};