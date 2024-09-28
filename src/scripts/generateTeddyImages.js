import { generateTeddyImage, saveTeddyImage } from '../utils/imageGenerator';
import { supabase } from '../lib/supabase';
import { teddyData } from '../data/teddyData';

const generateAndSaveImages = async () => {
  for (const teddy of teddyData) {
    const imageUrl = await generateTeddyImage(teddy.name, teddy.description);
    if (imageUrl) {
      const savedUrl = await saveTeddyImage(teddy.name, imageUrl);
      if (savedUrl) {
        console.log(`Image for ${teddy.name} generated and saved: ${savedUrl}`);
        // Update the teddy data in Supabase with the new image URL
        const { error } = await supabase
          .from('terrible_teddies')
          .update({ imageUrl: savedUrl })
          .eq('name', teddy.name);
        
        if (error) {
          console.error(`Error updating image URL for ${teddy.name}:`, error);
        }
      }
    }
  }
};

generateAndSaveImages();