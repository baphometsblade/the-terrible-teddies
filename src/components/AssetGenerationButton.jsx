import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const AssetGenerationButton = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  const handleGenerateAssets = useCallback(async () => {
    setIsGenerating(true);
    setProgress(0);
    setCurrentImage(null);
    setShowDialog(true);

    try {
      const response = await fetch('/api/generate-assets', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate assets');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;
          const data = JSON.parse(line);

          if (data.progress) {
            setProgress(data.progress);
          }
          if (data.currentImage) {
            setCurrentImage(data.currentImage);
          }
        }
      }

      toast({
        title: "Assets Generated",
        description: "All assets have been successfully generated.",
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
  }, [toast]);

  const handleCloseDialog = useCallback(() => {
    if (!isGenerating) {
      setShowDialog(false);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generating Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Progress value={progress} className="w-full" />
            <p className="mt-2 text-center">{progress.toFixed(2)}% Complete</p>
          </div>
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