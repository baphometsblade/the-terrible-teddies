import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { generateGameAssets } from '../utils/generateGameAssets';

export const ImageGenerator = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleGenerateAssets = async () => {
    setLoading(true);
    setProgress(0);

    try {
      await generateGameAssets((progress) => {
        setProgress(progress);
      });

      toast({
        title: "Asset Generation Complete",
        description: "All game assets have been generated and stored.",
        variant: "success",
      });
      onComplete();
    } catch (error) {
      console.error('Error in asset generation:', error);
      toast({
        title: "Asset Generation Failed",
        description: "An error occurred during asset generation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-4">Generate Game Assets</h2>
        <p className="mb-4">Click the button below to generate images for the game cards.</p>
        <Button 
          onClick={handleGenerateAssets} 
          disabled={loading}
          className="w-full mb-4"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Assets'
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
