import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { generateTeddyImage, generateBackgroundImage } from '../utils/imageGenerator';
import { supabase } from '../lib/supabase';

export const AssetGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const generateTeddyBear = async () => {
    const names = ["Whiskey Whiskers", "Madame Mistletoe", "Baron Von Blubber", "Bella Bombshell", "Professor Playful"];
    const titles = ["The Smooth Operator", "The Festive Flirt", "The Inflated Ego", "The Dynamite Diva", "The Teasing Tutor"];
    const specialMoves = ["On the Rocks", "Sneak Kiss", "Burst Bubble", "Heart Stopper", "Mind Game"];

    const randomIndex = Math.floor(Math.random() * names.length);
    const name = names[randomIndex];
    const title = titles[randomIndex];
    const specialMove = specialMoves[randomIndex];
    const description = `A cheeky teddy with a knack for ${specialMove.toLowerCase()}.`;

    const imageUrl = await generateTeddyImage(name, description);

    return {
      name,
      title,
      description,
      attack: Math.floor(Math.random() * 3) + 4, // 4-6
      defense: Math.floor(Math.random() * 3) + 4, // 4-6
      specialMove,
      imageUrl
    };
  };

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setProgress(0);
    const generatedAssets = [];

    try {
      for (let i = 0; i < 5; i++) { // Generate 5 bears for testing
        const bear = await generateTeddyBear();
        generatedAssets.push(bear);
        setProgress(((i + 1) / 5) * 100);
      }

      // Generate a background image
      const backgroundUrl = await generateBackgroundImage("Cheeky teddy bear card game");

      // Save generated assets to Supabase
      const { data, error } = await supabase
        .from('terrible_teddies')
        .insert(generatedAssets);

      if (error) throw error;

      // Save background image URL to Supabase (you might want to create a separate table for this)
      const { data: bgData, error: bgError } = await supabase
        .from('game_assets')
        .insert({ type: 'background', url: backgroundUrl });

      if (bgError) throw bgError;

      toast({
        title: "Assets Generated",
        description: `Successfully generated ${generatedAssets.length} Terrible Teddies and a background image!`,
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
        <Progress value={progress} className="w-full" />
      )}
    </div>
  );
};