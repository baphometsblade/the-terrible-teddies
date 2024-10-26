interface BearMetadata {
  id: string;
  name: string;
  title: string;
  description: string;
  placeholderImage: string;
  attack: number;
  defense: number;
  specialMove: string;
  specialMoveDescription: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  element?: 'fire' | 'ice' | 'nature' | 'dark' | 'light' | 'cosmic' | 'chaos';
}

export const bearMetadata: BearMetadata[] = [
  {
    id: "whiskey-whiskers",
    name: "Whiskey Whiskers",
    title: "The Smooth Operator",
    description: "A suave bear with a penchant for fine spirits and even finer company. His fur is slicked back, and he's always holding a tiny martini glass.",
    placeholderImage: "https://images.unsplash.com/photo-1472396961693-142e6e269027",
    attack: 7,
    defense: 5,
    specialMove: "On the Rocks",
    specialMoveDescription: "Lowers opponent's defense with intoxicating charisma",
    rarity: 'epic',
    element: 'dark'
  },
  {
    id: "madame-mistletoe",
    name: "Madame Mistletoe",
    title: "The Festive Flirt",
    description: "Always ready with a sly wink and a sprig of mistletoe, this bear's fur is adorned with holiday lights and a cheeky grin.",
    placeholderImage: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158",
    attack: 6,
    defense: 6,
    specialMove: "Sneak Kiss",
    specialMoveDescription: "Stuns the opponent with a surprise smooch",
    rarity: 'rare',
    element: 'light'
  },
  {
    id: "quantum-cuddles",
    name: "Quantum Cuddles",
    title: "The Reality Bender",
    description: "A teddy that exists in multiple dimensions simultaneously. Each hug creates a temporal paradox.",
    placeholderImage: "https://images.unsplash.com/photo-1518005020951-eccb494ad742",
    attack: 8,
    defense: 6,
    specialMove: "Quantum Entanglement",
    specialMoveDescription: "Creates a duplicate of itself in an alternate timeline",
    rarity: 'legendary',
    element: 'cosmic'
  },
  {
    id: "disco-destructor",
    name: "Disco Destructor",
    title: "The Groovy Gladiator",
    description: "A funky bear that turns every battle into a dance-off. Their moves are literally killer.",
    placeholderImage: "https://images.unsplash.com/photo-1492321936769-b49830bc1d1e",
    attack: 7,
    defense: 5,
    specialMove: "Disco Inferno",
    specialMoveDescription: "Forces all enemies to dance, reducing their attack power",
    rarity: 'epic',
    element: 'light'
  },
  {
    id: "void-hugger",
    name: "Void Hugger",
    title: "The Abyss Walker",
    description: "A teddy bear made from the fabric of darkness itself. Its hugs feel like falling into infinity.",
    placeholderImage: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86",
    attack: 9,
    defense: 4,
    specialMove: "Void Embrace",
    specialMoveDescription: "Banishes an enemy to the shadow realm temporarily",
    rarity: 'legendary',
    element: 'dark'
  },
  {
    id: "glitch-bear",
    name: "Glitch Bear",
    title: "The Bug Exploiter",
    description: "A teddy that learned to manipulate the matrix. Reality tends to malfunction around it.",
    placeholderImage: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7",
    attack: 6,
    defense: 7,
    specialMove: "System Crash",
    specialMoveDescription: "Causes random glitches in the opponent's stats",
    rarity: 'epic',
    element: 'chaos'
  }
];

export const getPlaceholderImage = (bearId: string): string => {
  const bear = bearMetadata.find(b => b.id === bearId);
  return bear?.placeholderImage || "https://images.unsplash.com/photo-1472396961693-142e6e269027";
};

export const getBearMetadata = (bearId: string): BearMetadata | undefined => {
  return bearMetadata.find(b => b.id === bearId);
};

export const getRarityColor = (rarity: BearMetadata['rarity']): string => {
  switch (rarity) {
    case 'common':
      return 'text-gray-500';
    case 'rare':
      return 'text-blue-500';
    case 'epic':
      return 'text-purple-500';
    case 'legendary':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
};

export const getElementColor = (element: BearMetadata['element']): string => {
  switch (element) {
    case 'fire':
      return 'text-red-500';
    case 'ice':
      return 'text-blue-300';
    case 'nature':
      return 'text-green-500';
    case 'dark':
      return 'text-purple-900';
    case 'light':
      return 'text-yellow-400';
    case 'cosmic':
      return 'text-indigo-500';
    case 'chaos':
      return 'text-rose-500';
    default:
      return 'text-gray-500';
  }
};
