import axios from 'axios';
import { supabase } from '../../lib/supabase';

const UNSPLASH_API_KEY = process.env.VITE_UNSPLASH_ACCESS_KEY;

export const fetchUnsplashImage = async (query: string): Promise<string | null> => {
  try {
    const response = await axios.get(
      `https://api.unsplash.com/search/photos?query=teddy+bear+${query}&client_id=${UNSPLASH_API_KEY}`
    );
    return response.data.results[0]?.urls.regular || null;
  } catch (error) {
    console.error('Error fetching Unsplash image:', error);
    return null;
  }
};

export const uploadImageToSupabase = async (imageUrl: string, fileName: string): Promise<string | null> => {
  try {
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const blob = new Blob([imageResponse.data], { type: 'image/jpeg' });
    
    const { data, error } = await supabase.storage
      .from('game-assets')
      .upload(`teddies/${fileName}.jpg`, blob, { upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('game-assets')
      .getPublicUrl(`teddies/${fileName}.jpg`);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image to Supabase:', error);
    return null;
  }
};