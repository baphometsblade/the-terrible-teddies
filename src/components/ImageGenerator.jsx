import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '../integrations/supabase';
import { Loader2 } from 'lucide-react';

const CARD_TYPES = [
  { name: 'Pillow Fight', type: 'Action', description: 'A cute cartoon teddy bear wielding a fluffy pillow as a weapon, ready for a playful battle', energyCost: 2 },
  { name: 'Bear Trap', type: 'Trap', description: 'A cute cartoon teddy bear setting up a comical, oversized mousetrap with a cupcake as bait', energyCost: 3 },
  { name: 'Stuffing Surge', type: 'Special', description: 'A cute cartoon teddy bear glowing with magical energy, surrounded by floating cotton stuffing', energyCost: 4 },
  { name: 'Tickle Attack', type: 'Action', description: 'A cute cartoon mischievous teddy bear tickling another teddy bear who is laughing uncontrollably', energyCost: 1 },
  { name: 'Sticky Honey', type: 'Trap', description: 'A cute cartoon teddy bear stuck in a pool of golden honey, looking adorably confused', energyCost: 2 },
  { name: 'Teddy Tantrum', type: 'Special', description: 'A cute cartoon angry teddy bear throwing a comical fit, with stuffing flying everywhere', energyCost: 3 },
];

const PICO_API_URL = 'https://backend.buildpicoapps.com/aero/run/image-generation-api';

export const ImageGenerator = ({ onComplete }) => {
  const [generatedImages, setGeneratedImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const generateAndStoreImage = async (card) => {
    const prompt = `${card.description}, in a cute cartoon style, vibrant colors, child-friendly, for a card game called "Terrible Teddies"`;
    try {
      const response = await fetch(PICO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PICO_API_KEY}`
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.image_url;

      const newImages = { ...generatedImages };
      newImages[card.name] = imageUrl;
      setGeneratedImages(newImages);

      // Store the image URL in the Supabase database
      const { error } = await supabase
        .from('generated_images')
        .upsert({
          name: card.name,
          url: imageUrl,
          prompt: card.description,
          type: card.type,
          energy_cost: card.energyCost
        }, { onConflict: 'name' });

      if (error) {
        console.error('Error storing image URL:', error);
      }
    } catch (error) {
      console.error(`Error generating image for ${card.name}:`, error);
      throw error;
    }
  };

  const generateAllImages = async () => {
    setLoading(true);
    try {
      const existingImages = await supabase.from('generated_images').select('name');
      const existingImageNames = new Set(existingImages.data.map(img => img.name));

      for (let i = 0; i < CARD_TYPES.length; i++) {
        const card = CARD_TYPES[i];
        if (!existingImageNames.has(card.name)) {
          await generateAndStoreImage(card);
        }
        setProgress(((i + 1) / CARD_TYPES.length) * 100);
      }
      onComplete();
    } catch (error) {
      console.error('Error generating all images:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
        <p className="text-lg font-semibold text-purple-700">Generating images... {Math.round(progress)}%</p>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
          <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" style={{width: `${progress}%`}}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={generateAllImages}
        className="w-full bg-purple-600 text-white font-bold py-2 px-4 rounded hover:bg-purple-700 transition-colors duration-300"
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Generate All Images'}
      </button>
      {loading && (
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold text-purple-700">Generating images... {Math.round(progress)}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
            <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" style={{width: `${progress}%`}}></div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {CARD_TYPES.map((card) => (
          <Card key={card.name} className="overflow-hidden">
            <CardContent className="p-4">
              <h3 className="text-lg font-bold">{card.name}</h3>
              <p className="text-sm text-gray-600">{card.type}</p>
              <p className="text-sm text-gray-600">Energy Cost: {card.energyCost}</p>
              {generatedImages[card.name] ? (
                <img src={generatedImages[card.name]} alt={card.name} className="w-full h-48 object-cover mt-2 rounded-lg shadow-md" />
              ) : (
                <div className="w-full h-48 bg-gray-200 animate-pulse mt-2 rounded-lg"></div>
              )}
              <p className="text-xs mt-2 italic">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
