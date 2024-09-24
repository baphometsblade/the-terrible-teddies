import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { generateGameAssets } from '../utils/generateGameAssets';

export const AssetGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setProgress(0);
    try {
      await generateGameAssets((progress) => {
        setProgress(progress);
      });
      toast({
        title: 'Assets Generated',
        description: 'All game assets have been successfully created and stored.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error generating assets:', error);
      toast({
        title: 'Asset Generation Failed',
        description: 'An error occurred while generating game assets. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Generate Game Assets</h2>
      <Button
        onClick={handleGenerateAssets}
        disabled={isGenerating}
        className="w-full mb-4"
      >
        {isGenerating ? 'Generating...' : 'Generate Assets'}
      </Button>
      {isGenerating && (
        <div className="mt-4">
          <Progress value={progress} className="w-full" />
          <p className="text-center mt-2">{Math.round(progress)}% complete</p>
        </div>
      )}
    </div>
  );
};