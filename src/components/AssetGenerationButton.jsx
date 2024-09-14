import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateGameAssets } from '../scripts/generate-game-assets';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const AssetGenerationButton = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [generatedCards, setGeneratedCards] = useState([]);
  const [error, setError] = useState(null);
  const [totalCards, setTotalCards] = useState(0);
  const { toast } = useToast();

  const handleGenerateAssets = useCallback(async () => {
    setIsGenerating(true);
    setProgress(0);
    setCurrentImage(null);
    setGeneratedCards([]);
    setError(null);
    setShowDialog(true);

    try {
      await generateGameAssets((data) => {
        if (data.total_cards) {
          setTotalCards(data.total_cards);
        } else if (data.progress) {
          setProgress(data.progress);
          setCurrentImage(data.currentImage);
          setGeneratedCards((prev) => [...prev, { name: data.currentImage, url: data.url }]);
        }
      });

      toast({
        title: "Assets Generated",
        description: `Successfully generated ${generatedCards.length} assets.`,
        variant: "success",
      });
    } catch (error) {
      console.error('Error generating assets:', error);
      setError(error.message || "Failed to generate assets. Please try again.");
      toast({
        title: "Error",
        description: `Failed to generate assets: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const handleCloseDialog = useCallback(() => {
    if (!isGenerating) {
      setShowDialog(false);
      setError(null);
    }
  }, [isGenerating]);

  return (
    <>
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
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generating Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Progress value={progress} className="w-full" />
            <p className="mt-2 text-center">{progress.toFixed(2)}% Complete</p>
            <p className="text-center text-sm text-gray-500">
              Generated {generatedCards.length} out of {totalCards} cards
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error}
                {error.includes("404") && (
                  <p className="mt-2">
                    The asset generation endpoint might not be set up correctly. Please check your server configuration and ensure the API route exists.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          <ScrollArea className="h-[400px] mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {generatedCards.map((card, index) => (
                <div key={index} className="border rounded p-2">
                  <img src={card.url} alt={card.name} className="w-full h-32 object-cover mb-2" />
                  <p className="text-sm font-semibold">{card.name}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
          {currentImage && (
            <div className="mt-4">
              <p className="mb-2 font-semibold">Current Image:</p>
              <img src={currentImage} alt="Current generated image" className="w-full h-auto" />
            </div>
          )}
          {!isGenerating && (
            <Button onClick={handleCloseDialog} className="mt-4">Close</Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
