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

export const ImageGenerator = ({ onComplete }) => {
  const [generatedImages, setGeneratedImages] = useState({});
  const [loading, setLoading] = useState(true);

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
      if (Object.keys(images).length === CARD_TYPES.length) {
        setLoading(false);
        onComplete();
      } else {
        generateAllImages();
      }
    }
  };

  const generateAllImages = async () => {
    try {
      const prompts = CARD_TYPES.map(card => `${card.description}, cute cartoon style`);
      const response = await fetch("https://a.picoapps.xyz/boy-every", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompts })
      });
      const data = await response.json();
      if (data.status === 'success') {
        const newImages = {};
        data.imageUrls.forEach((url, index) => {
          const card = CARD_TYPES[index];
          newImages[card.name] = url;
        });
        setGeneratedImages(newImages);

        // Store or update the image URLs in the Supabase database
        const upsertData = CARD_TYPES.map((card, index) => ({
          name: card.name,
          url: data.imageUrls[index],
          prompt: card.description,
          type: card.type,
          energy_cost: card.energyCost
        }));
        const { error } = await supabase
          .from('generated_images')
          .upsert(upsertData, { onConflict: 'name' });
      
        if (error) {
          console.error('Error storing image URLs:', error);
        } else {
          setLoading(false);
          onComplete();
        }
      } else {
        console.error('Error generating images:', data);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center">Generating images...</div>;
  }

  return (
    <div className="space-y-4">
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
