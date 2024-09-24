import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from "@/components/ui/use-toast";
import { generateGameAssets } from '../utils/generateGameAssets';
import { motion } from 'framer-motion';

export const AssetGenerator = ({ onComplete }) => {
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
        description: 'All cheeky game assets have been successfully created and stored.',
        variant: 'success',
      });
      onComplete();
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-4 bg-pink-100 rounded-lg shadow-md"
    >
      <h2 className="text-2xl font-bold mb-4 text-purple-800">Generate Cheeky Game Assets</h2>
      <p className="mb-4 text-purple-600">Click the button below to generate saucy images for the game cards.</p>
      <Button
        onClick={handleGenerateAssets}
        disabled={isGenerating}
        className="w-full mb-4 bg-purple-500 hover:bg-purple-600 text-white"
      >
        {isGenerating ? 'Generating Naughty Assets...' : 'Generate Cheeky Assets'}
      </Button>
      {isGenerating && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4"
        >
          <Progress value={progress} className="w-full" />
          <p className="text-center mt-2 text-purple-700">{Math.round(progress)}% complete</p>
        </motion.div>
      )}
    </motion.div>
  );
};
