import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '../integrations/supabase';

const TOTAL_CARDS = 40;

export const AssetGenerationButton = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [generatedCards, setGeneratedCards] = useState([]);
  const { toast } = useToast();

  const handleGenerateAssets = useCallback(async () => {
    setIsGenerating(true);
    setProgress(0);
    setCurrentImage(null);
    setGeneratedCards([]);
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
          try {
            const data = JSON.parse(line);
            if (typeof data.progress === 'number') {
              setProgress(data.progress);
            }
            if (data.currentImage) {
              setCurrentImage(data.currentImage);
              setGeneratedCards(prev => [...prev, { name: data.name, type: data.type, image: data.currentImage }]);
            }
          } catch (error) {
            console.error('Error parsing JSON:', error);
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

  useEffect(() => {
    if (progress >= 100) {
      setIsGenerating(false);
    }
  }, [progress]);

  useEffect(() => {
    const fetchGeneratedCards = async () => {
      const { data, error } = await supabase
        .from('generated_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching generated cards:', error);
      } else {
        setGeneratedCards(data);
      }
    };

    fetchGeneratedCards();
  }, []);

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
              Generated {generatedCards.length} out of {TOTAL_CARDS} cards
            </p>
          </div>
          <ScrollArea className="h-[400px] mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {generatedCards.map((card, index) => (
                <div key={index} className="border rounded p-2">
                  <img src={card.url} alt={card.name} className="w-full h-32 object-cover mb-2" />
                  <p className="text-sm font-semibold">{card.name}</p>
                  <p className="text-xs text-gray-500">{card.type}</p>
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