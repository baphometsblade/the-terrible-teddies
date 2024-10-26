import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from 'lucide-react';
import { scrapeAndUploadImages, getAllTeddyMetadata } from '../utils/imageScraperUtils';

const TeddyMetadataManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState(getAllTeddyMetadata());
  const { toast } = useToast();

  const handleScrapeImages = async () => {
    setIsLoading(true);
    try {
      const uploadedImages = await scrapeAndUploadImages();
      setMetadata(getAllTeddyMetadata());
      toast({
        title: "Images Updated",
        description: `Successfully updated ${Object.keys(uploadedImages).length} teddy images!`,
        variant: "success",
      });
    } catch (error) {
      console.error('Error scraping images:', error);
      toast({
        title: "Error",
        description: "Failed to update teddy images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Teddy Metadata Manager</h2>
        <Button onClick={handleScrapeImages} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Images...
            </>
          ) : (
            'Update Teddy Images'
          )}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metadata.map((teddy) => (
          <Card key={teddy.id} className="overflow-hidden">
            <CardHeader>
              <CardTitle>{teddy.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square relative mb-2">
                <img
                  src={teddy.imageUrl || teddy.placeholderImage}
                  alt={teddy.name}
                  className="absolute inset-0 w-full h-full object-cover rounded-md"
                />
              </div>
              <p className="text-sm font-semibold text-gray-600">{teddy.title}</p>
              <p className="text-sm text-gray-500 mb-2">{teddy.description}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>Attack: {teddy.attack}</p>
                <p>Defense: {teddy.defense}</p>
                <p>Element: {teddy.element}</p>
                <p>Rarity: {teddy.rarity}</p>
              </div>
              <div className="mt-2">
                <p className="text-sm font-semibold">{teddy.specialMove}</p>
                <p className="text-sm text-gray-500">{teddy.specialMoveDescription}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TeddyMetadataManager;