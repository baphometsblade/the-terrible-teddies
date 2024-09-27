import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { generateTeddyBears } from '../utils/teddyGenerator';

const TeddyGenerator = ({ onGenerate }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generatedBears = await generateTeddyBears(5); // Generate 5 bears
      onGenerate(generatedBears);
    } catch (error) {
      console.error('Error generating bears:', error);
    }
    setIsGenerating(false);
  };

  return (
    <Button onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating ? 'Generating...' : 'Generate Teddies'}
    </Button>
  );
};

export default TeddyGenerator;