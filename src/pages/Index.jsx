import React, { useState, useEffect } from 'react';
import { generateGameAssets } from '../utils/generateGameAssets';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const Index = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedAssets, setGeneratedAssets] = useState([]);

  const handleGenerateAssets = async () => {
    setIsGenerating(true);
    setProgress(0);
    try {
      const assets = await generateGameAssets((progress) => {
        setProgress(progress);
      });
      setGeneratedAssets(assets);
    } catch (error) {
      console.error('Error generating assets:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Terrible Teddies</h1>
      <Button onClick={handleGenerateAssets} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate Assets'}
      </Button>
      {isGenerating && (
        <div className="mt-4">
          <Progress value={progress} className="w-full" />
          <p className="text-center mt-2">{Math.round(progress)}% complete</p>
        </div>
      )}
      {generatedAssets.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          {generatedAssets.map((asset, index) => (
            <div key={index} className="border p-4 rounded">
              <img src={asset.url} alt={asset.name} className="w-full h-48 object-cover mb-2" />
              <p className="font-bold">{asset.name}</p>
              <p>{asset.type}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Index;