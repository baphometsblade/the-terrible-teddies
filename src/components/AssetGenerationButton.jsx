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
      toast({
        title: "Generating Assets",
        description: "This process may take a few minutes. Please wait...",
        variant: "default",
      });

      const response = await fetch('/api/generate-assets', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate assets');
      }

      const result = await response.json();
      toast({
        title: "Assets Generated",
        description: `Generated ${result.imagesCount} images and ${result.cardsCount} cards.`,
        variant: "success",
      });
    } catch (error) {
      console.error('Error generating assets:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate assets. Please try again.",
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
        'Generate All Assets'
      )}
    </Button>
  );
};