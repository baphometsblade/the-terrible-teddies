import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase';

export const ImageGenerationModal = ({ onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateImage = async () => {
    if (!prompt) {
      toast({
        title: "Error",
        description: "Please enter a prompt for the image generation.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      setGeneratedImage(data.imageUrl);

      toast({
        title: "Success",
        description: "Image generated successfully!",
        variant: "success",
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveImage = async () => {
    if (!generatedImage) return;

    try {
      const { data, error } = await supabase
        .from('generated_images')
        .insert([
          { url: generatedImage, prompt: prompt }
        ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Image saved successfully!",
        variant: "success",
      });

      onClose();
    } catch (error) {
      console.error('Error saving image:', error);
      toast({
        title: "Error",
        description: "Failed to save image. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Generate Custom Teddy Image</h2>
        <Input
          type="text"
          placeholder="Enter your image prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mb-4"
        />
        <Button
          onClick={handleGenerateImage}
          disabled={isGenerating}
          className="w-full mb-4"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Image'
          )}
        </Button>
        {generatedImage && (
          <div className="mb-4">
            <img src={generatedImage} alt="Generated Teddy" className="w-full rounded-lg" />
            <Button onClick={handleSaveImage} className="w-full mt-2">
              Save Image
            </Button>
          </div>
        )}
        <Button onClick={onClose} variant="outline" className="w-full">
          Close
        </Button>
      </div>
    </motion.div>
  );
};