import axios from 'axios';
import { supabase } from '../lib/supabase';
import { TeddyCard, Element } from '../types/types';

const UNSPLASH_API_KEY = process.env.VITE_UNSPLASH_ACCESS_KEY;

interface TeddyMetadata {
  id: string;
  name: string;
  title: string;
  description: string;
  element: Element;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  attack: number;
  defense: number;
  specialMove: string;
  specialMoveDescription: string;
  imageUrl: string;
  placeholderImage: string;
}

const teddyMetadata: TeddyMetadata[] = [
  {
    id: "whiskey-whiskers",
    name: "Whiskey Whiskers",
    title: "The Smooth Operator",
    description: "A suave bear with a penchant for fine spirits and even finer company.",
    element: 'dark',
    rarity: 'epic',
    attack: 7,
    defense: 5,
    specialMove: "On the Rocks",
    specialMoveDescription: "Lowers opponent's defense with intoxicating charisma",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158"
  },
  {
    id: "madame-mistletoe",
    name: "Madame Mistletoe",
    title: "The Festive Flirt",
    description: "Always ready with a sly wink and a sprig of mistletoe.",
    element: 'light',
    rarity: 'rare',
    attack: 6,
    defense: 6,
    specialMove: "Sneak Kiss",
    specialMoveDescription: "Stuns the opponent with a surprise smooch",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7"
  },
  {
    id: "quantum-cuddles",
    name: "Quantum Cuddles",
    title: "The Reality Bender",
    description: "A teddy that exists in multiple dimensions simultaneously.",
    element: 'cosmic',
    rarity: 'legendary',
    attack: 8,
    defense: 6,
    specialMove: "Quantum Entanglement",
    specialMoveDescription: "Creates a duplicate of itself in an alternate timeline",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5"
  },
  {
    id: "disco-bear",
    name: "Disco Bear",
    title: "The Groove Master",
    description: "A funky bear who never stopped living in the 70s. His dance moves are lethal!",
    element: 'light',
    rarity: 'epic',
    attack: 6,
    defense: 6,
    specialMove: "Disco Inferno",
    specialMoveDescription: "Dazzles opponents with spectacular dance moves, reducing their accuracy",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1525268771113-32d9e9021a97"
  },
  {
    id: "professor-paws",
    name: "Professor Paws",
    title: "The Mad Scientist",
    description: "A brilliant but slightly unhinged scientist bear with a penchant for unusual experiments.",
    element: 'cosmic',
    rarity: 'legendary',
    attack: 8,
    defense: 5,
    specialMove: "Quantum Theorem",
    specialMoveDescription: "Confuses opponents with complex mathematical equations",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1520808663317-647b476a81b9"
  },
  {
    id: "sir-snooze",
    name: "Sir Snooze",
    title: "The Dream Walker",
    description: "A narcoleptic knight who fights his battles in the dream realm.",
    element: 'dark',
    rarity: 'epic',
    attack: 7,
    defense: 6,
    specialMove: "Dream Invasion",
    specialMoveDescription: "Enters opponent's dreams to cause confusion and chaos",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1558679908-541bcf1249ff"
  },
  {
    id: "captain-chaos",
    name: "Captain Chaos",
    title: "The Unpredictable",
    description: "A bear whose actions are completely random, even to himself.",
    element: 'chaos',
    rarity: 'legendary',
    attack: 9,
    defense: 3,
    specialMove: "Random Rampage",
    specialMoveDescription: "Performs a completely unpredictable action with varying effects",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1523207911345-32501502db22"
  },
  {
    id: "lady-frost",
    name: "Lady Frost",
    title: "The Ice Queen",
    description: "A sophisticated bear with a heart as cold as ice and impeccable manners.",
    element: 'ice',
    rarity: 'epic',
    attack: 6,
    defense: 7,
    specialMove: "Frozen Etiquette",
    specialMoveDescription: "Freezes opponents while teaching them proper manners",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1548783094-3ccfa04d4bc9"
  },
  {
    id: "zen-master",
    name: "Zen Master",
    title: "The Enlightened One",
    description: "A peaceful bear who fights only when necessary, using the power of inner peace.",
    element: 'light',
    rarity: 'legendary',
    attack: 5,
    defense: 9,
    specialMove: "Tranquil Mind",
    specialMoveDescription: "Nullifies opponent's negative effects through meditation",
    imageUrl: "",
    placeholderImage: "https://images.unsplash.com/photo-1517783999520-f068d7431a60"
  }
];

export const scrapeAndUploadImages = async () => {
  const uploadedImages: { [key: string]: string } = {};

  for (const teddy of teddyMetadata) {
    try {
      // Search for teddy bear images on Unsplash
      const response = await axios.get(
        `https://api.unsplash.com/search/photos?query=teddy+bear+${teddy.name}&client_id=${UNSPLASH_API_KEY}`
      );

      if (response.data.results.length > 0) {
        const imageUrl = response.data.results[0].urls.regular;
        
        // Download image
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const blob = new Blob([imageResponse.data], { type: 'image/jpeg' });
        
        // Upload to Supabase Storage
        const fileName = `teddies/${teddy.id}.jpg`;
        const { data, error } = await supabase.storage
          .from('game-assets')
          .upload(fileName, blob, { upsert: true });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('game-assets')
          .getPublicUrl(fileName);

        uploadedImages[teddy.id] = publicUrl;
        
        // Update metadata
        teddy.imageUrl = publicUrl;
      }
    } catch (error) {
      console.error(`Error processing ${teddy.name}:`, error);
      // Use placeholder image if scraping fails
      teddy.imageUrl = teddy.placeholderImage;
    }
  }

  return uploadedImages;
};

export const getTeddyMetadata = (id: string): TeddyMetadata | undefined => {
  return teddyMetadata.find(teddy => teddy.id === id);
};

export const getAllTeddyMetadata = (): TeddyMetadata[] => {
  return teddyMetadata;
};
