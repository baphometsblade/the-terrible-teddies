import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages } from '../integrations/supabase';

export const ImageGenerator = ({ onComplete }) => {
  const { data: generatedImages, isLoading, error } = useGeneratedImages();
  const { toast } = useToast();

  if (isLoading) {
    return <div>Checking for generated images...</div>;
  }

  if (error) {
    return <div>Error loading images: {error.message}</div>;
  }

  if (generatedImages && generatedImages.length > 0) {
    return <div>Images have already been generated. Total images: {generatedImages.length}</div>;
  }

  const handleGenerateImages = async () => {
    toast({
      title: "Image Generation",
      description: "Please contact the administrator to generate images.",
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-4">Generate Game Images</h2>
        <p className="mb-4">Images need to be generated. Please contact the administrator.</p>
        <Button onClick={handleGenerateImages}>Generate Images</Button>
      </CardContent>
    </Card>
  );
};