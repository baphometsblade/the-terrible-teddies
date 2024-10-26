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
  element?: 'fire' | 'ice' | 'nature' | 'dark' | 'light';
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
    id: "baron-von-blubber",
    name: "Baron Von Blubber",
    title: "The Inflated Ego",
    description: "A pompous bear with an oversized monocle and a belly that's one puff away from popping.",
    placeholderImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e",
    attack: 8,
    defense: 4,
    specialMove: "Burst Bubble",
    specialMoveDescription: "Deflates opponent's ego and defense",
    rarity: 'epic',
    element: 'nature'
  },
  {
    id: "cyber-snuggles",
    name: "Cyber Snuggles",
    title: "The Digital Destroyer",
    description: "A high-tech teddy with LED eyes and chrome-plated paws. Specializes in virtual hugs and digital destruction.",
    placeholderImage: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b",
    attack: 9,
    defense: 3,
    specialMove: "Binary Blast",
    specialMoveDescription: "Corrupts opponent's defense systems",
    rarity: 'legendary',
    element: 'dark'
  },
  {
    id: "frost-hugs",
    name: "Frost Hugs",
    title: "The Arctic Assassin",
    description: "A polar bear teddy with ice crystals for fur. Their hugs are literally freezing.",
    placeholderImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e",
    attack: 5,
    defense: 8,
    specialMove: "Frozen Embrace",
    specialMoveDescription: "Freezes opponent, preventing their next action",
    rarity: 'epic',
    element: 'ice'
  },
  {
    id: "inferno-cuddles",
    name: "Inferno Cuddles",
    title: "The Blazing Berserker",
    description: "A teddy bear wreathed in eternal flames. Their stuffing is made of pure fire.",
    placeholderImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f",
    attack: 10,
    defense: 2,
    specialMove: "Flame Frenzy",
    specialMoveDescription: "Burns through opponent's defenses",
    rarity: 'legendary',
    element: 'fire'
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
    default:
      return 'text-gray-500';
  }
};