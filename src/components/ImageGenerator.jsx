import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages, useAddGeneratedImage } from '../integrations/supabase';
import { Loader2 } from 'lucide-react';

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

export const ImageGenerator = ({ onComplete }) => {
  const { data: generatedImages, isLoading, error, refetch } = useGeneratedImages();
  const addGeneratedImage = useAddGeneratedImage();
  const { toast } = useToast();

  const generateImage = async (type, index) => {
    console.log(`Generating image for ${type} Card ${index + 1}`);
    const name = `${type} Card ${index + 1}`;
    const prompt = `A cute teddy bear as a ${type} card for a card game`;
    const energyCost = Math.floor(Math.random() * 5) + 1;

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, name, type, energy_cost: energyCost }),
      });

      if (!response.ok) throw new Error('Failed to generate image');

      const data = await response.json();
      console.log('Image generated:', data.imageUrl);

      await addGeneratedImage.mutateAsync({
        name,
        url: data.imageUrl,
        prompt,
        type,
        energy_cost: energyCost
      });

      toast({
        title: "Image Generated",
        description: `Generated ${name}`,
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Error",
        description: `Failed to generate ${name}`,
        variant: "destructive",
      });
    }
  };

  const handleGenerateImages = async () => {
    console.log('Generate Images button clicked');
    for (let typeIndex = 0; typeIndex < CARD_TYPES.length; typeIndex++) {
      for (let i = 0; i < 8; i++) {
        await generateImage(CARD_TYPES[typeIndex], i);
      }
    }
    await refetch();
    onComplete();
  };

  if (isLoading) {
    return <div>Checking for generated images...</div>;
  }

  if (error) {
    return <div>Error loading images: {error.message}</div>;
  }

  if (generatedImages && generatedImages.length > 0) {
    return <div>Images have already been generated. Total images: {generatedImages.length}</div>;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-4">Generate Game Images</h2>
        <p className="mb-4">No images found. Click the button below to generate 40 card images.</p>
        <Button onClick={handleGenerateImages} disabled={addGeneratedImage.isLoading}>
          {addGeneratedImage.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Images'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};