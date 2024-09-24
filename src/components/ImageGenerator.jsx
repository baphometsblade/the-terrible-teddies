import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { generateAllAssets } from '../utils/assetGenerator';

const teddyList = [
  { name: "Blitzkrieg Bear", type: "Action" },
  { name: "Icy Ivan", type: "Defense" },
  { name: "Lady Lush", type: "Special" },
  { name: "Chainsaw Charlie", type: "Action" },
  { name: "Velvet Viper", type: "Trap" },
  // Add more teddies as needed
];

export const ImageGenerator = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleGenerateAssets = async () => {
    setLoading(true);
    setProgress(0);

    try {
      const totalTeddies = teddyList.length;
      const generatedAssets = [];

      for (let i = 0; i < totalTeddies; i++) {
        const teddy = teddyList[i];
        const asset = await generateAllAssets([teddy]);
        generatedAssets.push(asset[0]);
        setProgress(((i + 1) / totalTeddies) * 100);
      }

      toast({
        title: "Asset Generation Complete",
        description: `Generated ${generatedAssets.length} assets successfully.`,
        variant: "success",
      });
      onComplete(generatedAssets);
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
        <p className="mb-4">Click the button below to generate images for all Terrible Teddies.</p>
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
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-center mt-2">{Math.round(progress)}% complete</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
