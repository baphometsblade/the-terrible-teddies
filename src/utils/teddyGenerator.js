export const generateTeddyBear = () => {
  const names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Icy Ivan", "Lady Lush"];
  const titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Frosty Fighter", "The Party Animal"];
  const specialMoves = ["On the Rocks", "Sneak Kiss", "Burst Bubble", "Ice Age", "Drunken Master"];

  const randomIndex = Math.floor(Math.random() * names.length);

  return {
    name: names[randomIndex],
    title: titles[randomIndex],
    description: `A cheeky teddy with a knack for ${specialMoves[randomIndex].toLowerCase()}.`,
    attack: Math.floor(Math.random() * 3) + 4, // 4-6
    defense: Math.floor(Math.random() * 3) + 4, // 4-6
    specialMove: specialMoves[randomIndex],
  };
};