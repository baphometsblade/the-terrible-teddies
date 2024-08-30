import { supabase } from '../integrations/supabase';

export const uploadAssets = async () => {
  try {
    const response = await fetch('/api/generate-assets', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim() === '') continue;

        const data = JSON.parse(line);

        if (data.error) {
          console.error('Error during asset generation:', data.error);
          if (data.traceback) {
            console.error('Error traceback:', data.traceback);
          }
        } else if (data.completed) {
          console.log('Asset generation completed:', data);
        } else {
          console.log('Asset generation progress:', data);
        }
      }
    }

    console.log('Asset upload process completed');
  } catch (error) {
    console.error('Error in uploadAssets:', error);
    throw error;
  }
};