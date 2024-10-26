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