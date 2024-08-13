import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { useAddGeneratedImage } from '../integrations/supabase';

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

export const ImageGenerator = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const addGeneratedImage = useAddGeneratedImage();

  const generateAndStoreImage = async (card) => {
    try {
      console.log(`Generating image for ${card.name}`);
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: card.description,
          name: card.name,
          type: card.type,
          energy_cost: card.energyCost
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      console.log(`Image generated and stored for ${card.name}:`, data);

      await addGeneratedImage.mutateAsync({
        name: card.name,
        url: data.imageUrl,
        prompt: card.description,
        type: card.type,
        energy_cost: card.energyCost
      });

      return data.imageUrl;
    } catch (error) {
      console.error(`Error generating/storing image for ${card.name}:`, error);
      throw error;
    }
  };

  const generateImages = async () => {
    setLoading(true);
    setProgress(0);
    const totalCards = 40;
    let generatedCount = 0;

    try {
      for (let i = 0; i < totalCards; i++) {
        const card = {
          name: `Card ${i + 1}`,
          description: `A cute teddy bear as a ${CARD_TYPES[i % CARD_TYPES.length]} card for a card game`,
          type: CARD_TYPES[i % CARD_TYPES.length],
          energyCost: Math.floor(Math.random() * 5) + 1
        };

        await generateAndStoreImage(card);
        generatedCount++;
        setProgress((generatedCount / totalCards) * 100);
      }

      toast({
        title: "Image Generation Complete",
        description: `Generated and stored ${totalCards} images.`,
        variant: "success",
      });
      onComplete();
    } catch (error) {
      console.error('Error in image generation:', error);
      toast({
        title: "Image Generation Failed",
        description: `An error occurred: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-4">Generate Game Images</h2>
        <p className="mb-4">Click the button below to generate images for the game cards.</p>
        <Button 
          onClick={generateImages} 
          disabled={loading}
          className="w-full mb-4"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Images'
          )}
        </Button>
        {loading && (
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};