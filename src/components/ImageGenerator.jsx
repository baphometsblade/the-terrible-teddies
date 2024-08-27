import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages, useAddGeneratedImage } from '../integrations/supabase';
import { Loader2 } from 'lucide-react';

const CARD_TYPES = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];

export const ImageGenerator = ({ onComplete }) => {
  const { data: generatedImages, isLoading, error, refetch } = useGeneratedImages();
  const addGeneratedImage = useAddGeneratedImage();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(null);
  const [showAllTeddies, setShowAllTeddies] = useState(false);

  const generateImage = async (type, index) => {
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

      const newImage = {
        name,
        url: data.imageUrl,
        prompt,
        type,
        energy_cost: energyCost
      };

      await addGeneratedImage.mutateAsync(newImage);
      setCurrentImage(newImage);
      setProgress(prev => prev + (100 / 40));
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
    setIsGenerating(true);
    setProgress(0);
    setCurrentImage(null);
    for (let typeIndex = 0; typeIndex < CARD_TYPES.length; typeIndex++) {
      for (let i = 0; i < 8; i++) {
        await generateImage(CARD_TYPES[typeIndex], i);
      }
    }
    await refetch();
    setIsGenerating(false);
    onComplete();
  };

  if (isLoading) {
    return <div>Checking for generated images...</div>;
  }

  if (error) {
    return <div>Error loading images: {error.message}</div>;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-4">Generate Game Images</h2>
        {generatedImages && generatedImages.length > 0 ? (
          <div>
            <p className="mb-4">Images have already been generated. Total images: {generatedImages.length}</p>
            <Button onClick={() => setShowAllTeddies(!showAllTeddies)}>
              {showAllTeddies ? 'Hide Teddies' : 'Show All Teddies'}
            </Button>
            {showAllTeddies && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {generatedImages.map((image, index) => (
                  <img key={index} src={image.url} alt={image.name} className="w-full h-auto" />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="mb-4">No images found. Click the button below to generate 40 card images.</p>
            <Button onClick={handleGenerateImages} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Images'
              )}
            </Button>
            {isGenerating && (
              <>
                <Progress value={progress} className="mt-4" />
                {currentImage && (
                  <div className="mt-4">
                    <p>Currently generating: {currentImage.name}</p>
                    <img src={currentImage.url} alt={currentImage.name} className="w-full h-auto mt-2" />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};