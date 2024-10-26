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
    specialMoveDescription: "Lowers opponent's defense with intoxicating charisma"
  },
  {
    id: "madame-mistletoe",
    name: "Madame Mistletoe",
    title: "The Festive Flirt",
    description: "Always ready with a sly wink and a sprig of mistletoe, this bear's fur is adorned with holiday lights and a cheeky grin.",
    placeholderImage: "https://images.unsplash.com/photo-1439886183900-e79ec0057170",
    attack: 6,
    defense: 6,
    specialMove: "Sneak Kiss",
    specialMoveDescription: "Stuns the opponent with a surprise smooch"
  },
  {
    id: "baron-von-blubber",
    name: "Baron Von Blubber",
    title: "The Inflated Ego",
    description: "A pompous bear with an oversized monocle and a belly that's one puff away from popping.",
    placeholderImage: "https://images.unsplash.com/photo-1485833077593-4278bba3f11f",
    attack: 8,
    defense: 4,
    specialMove: "Burst Bubble",
    specialMoveDescription: "Deflates opponent's ego and defense"
  }
];

export const getPlaceholderImage = (bearId: string): string => {
  const bear = bearMetadata.find(b => b.id === bearId);
  return bear?.placeholderImage || "https://images.unsplash.com/photo-1472396961693-142e6e269027";
};

export const getBearMetadata = (bearId: string): BearMetadata | undefined => {
  return bearMetadata.find(b => b.id === bearId);
};