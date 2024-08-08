import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '../integrations/supabase';

const CARD_TYPES = [
  { name: 'Pillow Fight', type: 'Action', description: 'A teddy bear wielding a pillow as a weapon', energyCost: 2 },
  { name: 'Bear Trap', type: 'Trap', description: 'A cute teddy bear-themed trap', energyCost: 3 },
  { name: 'Stuffing Surge', type: 'Special', description: 'A teddy bear glowing with magical energy', energyCost: 4 },
  { name: 'Tickle Attack', type: 'Action', description: 'A mischievous teddy bear tickling another', energyCost: 1 },
  { name: 'Sticky Honey', type: 'Trap', description: 'A teddy bear stuck in a pool of honey', energyCost: 2 },
  { name: 'Teddy Tantrum', type: 'Special', description: 'An angry teddy bear throwing a fit', energyCost: 3 },
];

export const ImageGenerator = () => {
  const [generatedImages, setGeneratedImages] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchExistingImages();
  }, []);

  const fetchExistingImages = async () => {
    const { data, error } = await supabase
      .from('generated_images')
      .select('*');
    
    if (error) {
      console.error('Error fetching existing images:', error);
    } else {
      const images = {};
      data.forEach(item => {
        images[item.name] = item.url;
      });
      setGeneratedImages(images);
    }
  };

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
        
        // Store or update the image URL in the Supabase database
        const { error } = await supabase
          .from('generated_images')
          .upsert({ name: card.name, url: imageUrl, prompt: card.description, type: card.type, energy_cost: card.energyCost }, { onConflict: 'name' });
        
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
