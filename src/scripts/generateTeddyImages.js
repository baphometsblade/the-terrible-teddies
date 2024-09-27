import { generateTeddyImage, generateBackgroundImage } from '../utils/imageGenerator';
import { supabase } from '../lib/supabase';
import { teddyData } from '../data/teddyData';

const generateAndSaveImages = async () => {
  // Generate and save teddy bear images
  for (const teddy of teddyData) {
    const imageUrl = await generateTeddyImage(teddy.name, teddy.description);
    const { data, error } = await supabase.storage
      .from('teddy-images')
      .upload(`${teddy.name.replace(/\s+/g, '-').toLowerCase()}.png`, await (await fetch(imageUrl)).blob(), {
        cacheControl: '3600',
        upsert: false
      });
    if (error) console.error(`Error saving image for ${teddy.name}:`, error);
    else console.log(`Image saved for ${teddy.name}`);
  }

  // Generate and save background images
  const backgrounds = ['cheeky teddy bear battle', 'teddy bear casino', 'teddy bear beach party'];
  for (const bg of backgrounds) {
    const imageUrl = await generateBackgroundImage(bg);
    const { data, error } = await supabase.storage
      .from('background-images')
      .upload(`${bg.replace(/\s+/g, '-').toLowerCase()}.png`, await (await fetch(imageUrl)).blob(), {
        cacheControl: '3600',
        upsert: false
      });
    if (error) console.error(`Error saving background image for ${bg}:`, error);
    else console.log(`Background image saved for ${bg}`);
  }
};

generateAndSaveImages();