import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { generateBackgroundImage, saveBackgroundImage } from '../utils/backgroundGenerator';
import { supabase } from '../lib/supabase';

export const AssetGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const backgroundDescriptions = [
    "A messy bedroom with adult toys scattered around",
    "A chaotic living room after a wild teddy bear party",
    "A naughty teddy bear nightclub with dim lighting",
    "A steamy teddy bear spa with bubbling hot tubs",
    "A mischievous teddy bear casino with card tables"
  ];

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setProgress(0);
    const generatedAssets = [];

    try {
      // Generate background images
      for (let i = 0; i < backgroundDescriptions.length; i++) {
        const description = backgroundDescriptions[i];
        const imageUrl = await generateBackgroundImage(description);
        if (imageUrl) {
          const savedUrl = await saveBackgroundImage(description, imageUrl);
          if (savedUrl) {
            generatedAssets.push({ type: 'background', description, url: savedUrl });
            console.log(`Generated and saved background: ${description}`);
          } else {
            console.error(`Failed to save background: ${description}`);
          }
        } else {
          console.error(`Failed to generate background: ${description}`);
        }
        setProgress(((i + 1) / backgroundDescriptions.length) * 100);
      }

      toast({
        title: "Assets Generated",
        description: `Successfully generated ${generatedAssets.length} assets!`,
        variant: "success",
      });
    } catch (error) {
      console.error('Error generating assets:', error);
      toast({
        title: "Asset Generation Failed",
        description: "An error occurred while generating assets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Generate Terrible Teddies Assets</h2>
      <Button
        onClick={handleGenerateAssets}
        disabled={isGenerating}
        className="w-full mb-4"
      >
        {isGenerating ? 'Generating...' : 'Generate Assets'}
      </Button>
      {isGenerating && (
        <Progress value={progress} className="w-full" />
      )}
    </div>
  );
};