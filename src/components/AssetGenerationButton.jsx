import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export const AssetGenerationButton = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-assets', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate assets');
      }

      const result = await response.json();
      toast({
        title: "Assets Generated",
        description: `Generated ${result.imagesCount} images, ${result.cardsCount} cards, and game rules.`,
        variant: "success",
      });
    } catch (error) {
      console.error('Error generating assets:', error);
      toast({
        title: "Error",
        description: "Failed to generate assets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerateAssets}
      disabled={isGenerating}
      className="bg-purple-600 hover:bg-purple-700 text-white"
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating Assets...
        </>
      ) : (
        'Generate Game Assets'
      )}
    </Button>
  );
};