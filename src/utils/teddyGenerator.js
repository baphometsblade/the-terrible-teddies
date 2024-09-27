import { v4 as uuidv4 } from 'uuid';

const generatePlaceholderImage = (name) => {
  return `https://via.placeholder.com/150x150.png?text=${encodeURIComponent(name)}`;
};

const generateTeddyBear = () => {
  const names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Bella Bombshell", "Professor Playful"];
  const titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Dynamite Diva", "The Teasing Tutor"];
  const specialMoves = ["On the Rocks", "Sneak Kiss", "Burst Bubble", "Heart Stopper", "Mind Game"];

  const randomIndex = Math.floor(Math.random() * names.length);
  const name = names[randomIndex];
  const title = titles[randomIndex];
  const specialMove = specialMoves[randomIndex];

  return {
    id: uuidv4(),
    name,
    title,
    attack: Math.floor(Math.random() * 3) + 4, // 4-6
    defense: Math.floor(Math.random() * 3) + 4, // 4-6
    specialMove,
    imageUrl: generatePlaceholderImage(name)
  };
};

export const generateTeddyBears = (count) => {
  return Array.from({ length: count }, generateTeddyBear);
};