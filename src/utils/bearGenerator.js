import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const generateBearDescription = async (name) => {
  const prompt = `Create a humorous, adult-themed description for a teddy bear named "${name}" for the game Terrible Teddies. The description should be cheeky and irreverent, suitable for mature audiences.`;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content.trim();
};

const generateBearImage = async (name, description) => {
  const prompt = `Create a hyper-realistic, ultra-detailed image of a mischievous teddy bear named "${name}" for the adult card game "Terrible Teddies". The bear should embody cheeky, tongue-in-cheek humor with a hint of naughtiness. Make it visually striking and slightly provocative, suitable for an adult audience. Ensure the bear's expression and pose reflect its personality: ${description}`;

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  });

  return response.data[0].url;
};

const uploadBearImage = async (name, imageUrl) => {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const fileName = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
  const filePath = `bears/${fileName}`;

  const { data, error } = await supabase.storage
    .from('teddy-images')
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: true
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from('teddy-images')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};

export const generateBear = async () => {
  const names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Icy Ivan", "Lady Lush"];
  const name = names[Math.floor(Math.random() * names.length)];
  
  const description = await generateBearDescription(name);
  const imageUrl = await generateBearImage(name, description);
  const supabaseImageUrl = await uploadBearImage(name, imageUrl);

  const bear = {
    name,
    description,
    attack: Math.floor(Math.random() * 3) + 4, // 4-6
    defense: Math.floor(Math.random() * 3) + 4, // 4-6
    specialMove: `${name}'s Special Move`,
    imageUrl: supabaseImageUrl
  };

  const { data, error } = await supabase
    .from('terrible_teddies')
    .insert([bear]);

  if (error) throw error;

  return bear;
};

export const generateInitialBears = async (count = 50) => {
  const bears = [];
  for (let i = 0; i < count; i++) {
    const bear = await generateBear();
    bears.push(bear);
  }
  return bears;
};