import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { generateTeddyBears } from '../utils/teddyGenerator';

const TeddyGenerator = ({ onGenerate }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const generatedBears = await generateTeddyBears(5); // Generate 5 bears
      onGenerate(generatedBears);
    } catch (error) {
      console.error('Error generating bears:', error);
      setError('Failed to generate bears. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <Button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate Teddies'}
      </Button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default TeddyGenerator;