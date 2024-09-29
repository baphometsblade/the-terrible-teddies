import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { generateAllAssets } from '../utils/assetGenerator';

export const AssetGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setProgress(0);
    try {
      const assets = await generateAllAssets();
      setProgress(100);
      toast({
        title: "Assets Generated",
        description: `Successfully generated ${assets.length} assets!`,
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
        <div>
          <Progress value={progress} className="w-full mb-2" />
          <p className="text-sm text-gray-600">{Math.round(progress)}% complete</p>
        </div>
      )}
    </div>
  );
};