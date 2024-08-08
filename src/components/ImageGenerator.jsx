import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '../integrations/supabase';

const CARD_TYPES = [
  { name: 'Pillow Fight', type: 'Action', description: 'A teddy bear wielding a pillow as a weapon' },
  { name: 'Bear Trap', type: 'Trap', description: 'A cute teddy bear-themed trap' },
  { name: 'Stuffing Surge', type: 'Special', description: 'A teddy bear glowing with magical energy' },
  { name: 'Tickle Attack', type: 'Action', description: 'A mischievous teddy bear tickling another' },
  { name: 'Sticky Honey', type: 'Trap', description: 'A teddy bear stuck in a pool of honey' },
  { name: 'Teddy Tantrum', type: 'Special', description: 'An angry teddy bear throwing a fit' },
];

export const ImageGenerator = () => {
  const [generatedImages, setGeneratedImages] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateAllImages();
  }, []);

  const generateImage = async (prompt) => {
    try {
      const response = await fetch("https://a.picoapps.xyz/boy-every", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      if (data.status === 'success') {
        return data.imageUrl;
      } else {
        console.error('Error generating image:', data);
        return null;
      }
    } catch (error) {
      console.error('Error fetching image:', error);
      return null;
    }
  };

  const generateAllImages = async () => {
    setLoading(true);
    const newImages = {};
    for (const card of CARD_TYPES) {
      const imageUrl = await generateImage(`${card.description}, cute cartoon style`);
      if (imageUrl) {
        newImages[card.name] = imageUrl;
        
        // Store the image URL in the Supabase database
        const { error } = await supabase
          .from('generated_images')
          .insert({ url: imageUrl, prompt: card.description });
        
        if (error) {
          console.error('Error storing image URL:', error);
        }
      }
    }
    setGeneratedImages(newImages);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Button onClick={generateAllImages} disabled={loading}>
        {loading ? 'Generating...' : 'Regenerate All Images'}
      </Button>
      <div className="grid grid-cols-2 gap-4">
        {CARD_TYPES.map((card) => (
          <div key={card.name} className="border p-4 rounded-lg">
            <h3 className="text-lg font-bold">{card.name}</h3>
            <p className="text-sm text-gray-600">{card.type}</p>
            {generatedImages[card.name] ? (
              <img src={generatedImages[card.name]} alt={card.name} className="w-full h-auto mt-2 rounded-lg shadow-md" />
            ) : (
              <div className="w-full h-32 bg-gray-200 animate-pulse mt-2 rounded-lg"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
