import { supabase } from '../lib/supabase';
import axios from 'axios';

const MIDJOURNEY_API_URL = 'https://api.midjourney.com/v1/imagine'; // Replace with actual Midjourney API endpoint
const MIDJOURNEY_API_KEY = process.env.MIDJOURNEY_API_KEY;
const MIDJOURNEY_ID = process.env.MIDJOURNEY_ID;

const generateMidjourneyImage = async (prompt) => {
  try {
    const response = await axios.post(MIDJOURNEY_API_URL, {
      prompt: prompt,
      midjourney_id: MIDJOURNEY_ID,
    }, {
      headers: {
        'Authorization': `Bearer ${MIDJOURNEY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.image_url; // Adjust based on actual Midjourney API response structure
  } catch (error) {
    console.error('Error generating image with Midjourney:', error);
    throw error;
  }
};

const uploadImageToSupabase = async (imageUrl, fileName) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const { data, error } = await supabase.storage
      .from('teddy-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('teddy-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image to Supabase:', error);
    throw error;
  }
};

export const generateTeddyImage = async (name, description) => {
  const prompt = `Create a hyper-realistic, ultra-detailed image of a mischievous teddy bear named "${name}" for the adult card game "Terrible Teddies". The bear should embody cheeky, tongue-in-cheek humor with a hint of naughtiness. Make it visually striking and slightly provocative, suitable for an adult audience. Ensure the bear's expression and pose reflect its personality: ${description}`;

  const imageUrl = await generateMidjourneyImage(prompt);
  const fileName = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
  return await uploadImageToSupabase(imageUrl, fileName);
};

export const generateAllAssets = async (onProgress) => {
  const teddyBears = [
    { name: "Whiskey Whiskers", title: "The Smooth Operator" },
    { name: "Madame Mistletoe", title: "The Festive Flirt" },
    // ... Add all 50 teddy bears here
  ];

  const generatedAssets = [];

  for (let i = 0; i < teddyBears.length; i++) {
    const bear = teddyBears[i];
    try {
      const imageUrl = await generateTeddyImage(bear.name, bear.title);
      generatedAssets.push({
        name: bear.name,
        title: bear.title,
        imageUrl: imageUrl,
        attack: Math.floor(Math.random() * 3) + 5, // Random attack between 5-7
        defense: Math.floor(Math.random() * 3) + 4, // Random defense between 4-6
        special_move: `${bear.name}'s Special Move`, // Placeholder, replace with actual special moves
        special_move_description: `Description of ${bear.name}'s special move` // Placeholder, replace with actual descriptions
      });
      if (onProgress) {
        onProgress(((i + 1) / teddyBears.length) * 100);
      }
      console.log(`Generated asset for ${bear.name}`);
    } catch (error) {
      console.error(`Error generating asset for ${bear.name}:`, error);
    }
  }

  return generatedAssets;
};