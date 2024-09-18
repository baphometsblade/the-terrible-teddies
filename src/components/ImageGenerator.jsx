import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { useAddGeneratedImage, useAddCardImage } from '../integrations/supabase';

const CARD_TYPES = [
  { name: 'Pillow Fight', type: 'Action', description: 'A cute cartoon teddy bear wielding a fluffy pillow as a weapon, ready for a playful battle', energyCost: 2 },
  { name: 'Bear Trap', type: 'Trap', description: 'A cute cartoon teddy bear setting up a comical, oversized mousetrap with a cupcake as bait', energyCost: 3 },
  { name: 'Stuffing Surge', type: 'Special', description: 'A cute cartoon teddy bear glowing with magical energy, surrounded by floating cotton stuffing', energyCost: 4 },
  { name: 'Tickle Attack', type: 'Action', description: 'A cute cartoon mischievous teddy bear tickling another teddy bear who is laughing uncontrollably', energyCost: 1 },
  { name: 'Sticky Honey', type: 'Trap', description: 'A cute cartoon teddy bear stuck in a pool of golden honey, looking adorably confused', energyCost: 2 },
  { name: 'Teddy Tantrum', type: 'Special', description: 'A cute cartoon angry teddy bear throwing a comical fit, with stuffing flying everywhere', energyCost: 3 },
];

const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations';

export const ImageGenerator = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const addGeneratedImage = useAddGeneratedImage();
  const addCardImage = useAddCardImage();

  const generateAndStoreImage = async (card) => {
    const prompt = `${card.description}, in a cute cartoon style, vibrant colors, child-friendly, for a card game called "Terrible Teddies"`;
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          prompt: prompt,
          n: 1,
          size: "256x256"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      // Store the image URL in both tables
      await Promise.all([
        addCardImage.mutateAsync({
          name: card.name,
          url: imageUrl,
          prompt: card.description,
          type: card.type,
          energy_cost: card.energyCost
        }),
        addGeneratedImage.mutateAsync({
          name: card.name,
          url: imageUrl,
          prompt: card.description,
          type: card.type,
          energy_cost: card.energyCost
        })
      ]);

      return imageUrl;
    } catch (error) {
      console.error(`Error generating image for ${card.name}:`, error);
      throw error;
    }
  };

  const generateAllImages = async () => {
    setLoading(true);
    const generatedImages = {};
    try {
      for (let i = 0; i < CARD_TYPES.length; i++) {
        const card = CARD_TYPES[i];
        const imageUrl = await generateAndStoreImage(card);
        generatedImages[card.name] = imageUrl;
        setProgress(((i + 1) / CARD_TYPES.length) * 100);
      }
      
      toast({
        title: "Success",
        description: "All images have been generated and stored successfully!",
        variant: "success",
      });
      onComplete(generatedImages);
    } catch (error) {
      console.error('Error generating all images:', error);
      toast({
        title: "Error",
        description: "Failed to generate images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={generateAllImages}
        className="w-full bg-purple-600 text-white font-bold py-2 px-4 rounded hover:bg-purple-700 transition-colors duration-300"
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Generate All Images'}
      </Button>
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
              <div className="w-full h-48 bg-gray-200 mt-2 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-500">Image will be generated</p>
              </div>
              <p className="text-xs mt-2 italic">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
