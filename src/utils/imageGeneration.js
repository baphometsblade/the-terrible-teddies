import axios from 'axios';
import { supabase } from '../lib/supabase';

export async function generateTeddyBearImage(description) {
  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      prompt: `A cute and mischievous teddy bear ${description}`,
      n: 1,
      size: '512x512',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
    }
  );

  return response.data.data[0].url;
}

export async function uploadImageToSupabase(imageUrl, fileName) {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const { data, error } = await supabase.storage
    .from('teddy-bear-images')
    .upload(`public/${fileName}`, response.data);

  if (error) {
    console.error('Error uploading image:', error);
    return null;
  }
  return data.path;
}