import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from 'lucide-react';
import { scrapeAndUploadImages, getAllTeddyMetadata } from '../utils/imageScraperUtils';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from 'framer-motion';

const TeddyMetadataManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState(getAllTeddyMetadata());
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleScrapeImages = async () => {
    setIsLoading(true);
    setProgress(0);
    try {
      const totalTeddies = metadata.length;
      const uploadedImages = {};
      
      for (let i = 0; i < metadata.length; i++) {
        const teddy = metadata[i];
        const result = await scrapeAndUploadImages();
        Object.assign(uploadedImages, result);
        setProgress(((i + 1) / totalTeddies) * 100);
      }

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
      setProgress(0);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-yellow-500';
      case 'epic': return 'bg-purple-500';
      case 'rare': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getElementColor = (element: string) => {
    switch (element) {
      case 'fire': return 'bg-red-500';
      case 'ice': return 'bg-blue-300';
      case 'nature': return 'bg-green-500';
      case 'dark': return 'bg-gray-800';
      case 'light': return 'bg-yellow-300';
      case 'cosmic': return 'bg-purple-400';
      case 'chaos': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Teddy Metadata Manager</h2>
          <Button 
            onClick={handleScrapeImages} 
            disabled={isLoading}
            className="relative"
          >
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

        {isLoading && (
          <div className="mb-6">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-gray-600 mt-2 text-center">{Math.round(progress)}% complete</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {metadata.map((teddy) => (
            <motion.div
              key={teddy.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="space-y-1">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{teddy.name}</CardTitle>
                    <Badge className={`${getRarityColor(teddy.rarity)} text-white`}>
                      {teddy.rarity}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 italic">{teddy.title}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="aspect-square relative rounded-lg overflow-hidden">
                    <img
                      src={teddy.imageUrl || teddy.placeholderImage}
                      alt={teddy.name}
                      className="absolute inset-0 w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <p className="text-sm text-gray-700">{teddy.description}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-sm">
                      <span className="font-semibold">Attack:</span> {teddy.attack}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">Defense:</span> {teddy.defense}
                    </div>
                    <Badge className={`${getElementColor(teddy.element)} text-white col-span-2`}>
                      {teddy.element}
                    </Badge>
                  </div>
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-sm font-semibold">{teddy.specialMove}</p>
                    <p className="text-sm text-gray-600">{teddy.specialMoveDescription}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeddyMetadataManager;