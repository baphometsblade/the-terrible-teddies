import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const generateTeddyData = async () => {
  const prompt = `Generate a unique teddy bear for an adult-themed card game called "Terrible Teddies". Include the following details:
  1. Name: A unique, adult-humor-driven name for the bear.
  2. Title: A subtitle that adds depth or humor to the bear.
  3. Description: A tongue-in-cheek backstory (2-3 sentences).
  4. Special Move: A unique ability that impacts gameplay in funny or surprising ways.
  
  Format the response as a JSON object.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  const teddyData = JSON.parse(response.choices[0].message.content);
  teddyData.attack = Math.floor(Math.random() * 5) + 3; // 3-7
  teddyData.defense = Math.floor(Math.random() * 5) + 3; // 3-7

  return teddyData;
};

const generateTeddyImage = async (teddyData) => {
  const prompt = `Create a hyper-realistic, ultra-detailed image of a mischievous teddy bear named "${teddyData.name}" (${teddyData.title}) for the adult card game "Terrible Teddies". The bear should embody cheeky, tongue-in-cheek humor with a hint of naughtiness. Make it visually striking and slightly provocative, suitable for an adult audience. Ensure the bear's expression and pose reflect its title and personality. The image should be high resolution with intricate details of the bear's fur, accessories, and surroundings that match its character.`;

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  });

  return response.data[0].url;
};

export const generateTeddyBear = async () => {
  const teddyData = await generateTeddyData();
  const imageUrl = await generateTeddyImage(teddyData);
  teddyData.imageUrl = imageUrl;

  return teddyData;
};

export const generateAllTeddyBears = async (count = 50) => {
  const teddies = [];
  for (let i = 0; i < count; i++) {
    const teddy = await generateTeddyBear();
    teddies.push(teddy);

    // Store the teddy in Supabase
    const { data, error } = await supabase
      .from('terrible_teddies')
      .insert([teddy]);

    if (error) {
      console.error('Error storing teddy:', error);
    } else {
      console.log(`Teddy ${teddy.name} stored successfully`);
    }
  }
  return teddies;
};