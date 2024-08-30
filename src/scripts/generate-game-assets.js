import { triggerAssetGeneration } from './trigger_asset_generation.js';
import { supabase } from '../integrations/supabase';

export async function generateGameAssets(progressCallback) {
  console.log('Starting asset generation process...');

  try {
    const output = await triggerAssetGeneration();
    const lines = output.split('\n');
    let totalCards = 0;
    let generatedCards = 0;

    for (const line of lines) {
      if (line.trim() === '') continue;

      try {
        const data = JSON.parse(line);

        if (data.total_cards) {
          totalCards = data.total_cards;
          console.log(`Total cards to generate: ${totalCards}`);
          progressCallback({ total_cards: totalCards });
        } else if (data.progress) {
          generatedCards++;
          console.log(`Generated card ${generatedCards}/${totalCards}: ${data.currentImage}`);
          console.log(`Progress: ${data.progress.toFixed(2)}%`);

          // Update the database with the new image URL
          const { error } = await supabase
            .from('generated_images')
            .update({ url: data.url, back_url: data.back_url })
            .eq('name', data.currentImage);

          if (error) {
            console.error(`Error updating database for ${data.currentImage}:`, error);
          }

          progressCallback({
            progress: data.progress,
            currentImage: data.currentImage,
            url: data.url,
            back_url: data.back_url
          });
        } else if (data.error) {
          console.error('Error during asset generation:', data.error);
          if (data.traceback) {
            console.error('Error traceback:', data.traceback);
          }
          throw new Error(data.error);
        } else if (data.completed) {
          console.log('Asset generation completed successfully!');
          console.log(`Total generated cards: ${data.total_generated}`);
          return { total_generated: data.total_generated };
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        throw error;
      }
    }

    console.log('Asset generation process finished.');
    return { total_generated: generatedCards };
  } catch (error) {
    console.error('Error in asset generation process:', error);
    throw error;
  }
}
