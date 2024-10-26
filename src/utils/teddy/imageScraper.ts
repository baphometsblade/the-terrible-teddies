import { TeddyMetadata } from './types';
import { fetchUnsplashImage, uploadImageToSupabase } from './imageService';
import { teddyMetadata } from './metadata';

export const scrapeAndUploadImages = async () => {
  const uploadedImages: { [key: string]: string } = {};

  for (const teddy of teddyMetadata) {
    try {
      const imageUrl = await fetchUnsplashImage(teddy.name);
      
      if (imageUrl) {
        const supabaseUrl = await uploadImageToSupabase(imageUrl, teddy.id);
        if (supabaseUrl) {
          uploadedImages[teddy.id] = supabaseUrl;
          teddy.imageUrl = supabaseUrl;
        }
      }
    } catch (error) {
      console.error(`Error processing ${teddy.name}:`, error);
      teddy.imageUrl = teddy.placeholderImage;
    }
  }

  return uploadedImages;
};