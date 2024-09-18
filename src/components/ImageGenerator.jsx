import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { useAddGeneratedImage, useAddCardImage } from '../integrations/supabase';

// ... (keep existing CARD_TYPES and other constants)

export const ImageGenerator = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const addGeneratedImage = useAddGeneratedImage();
  const addCardImage = useAddCardImage();

  const generateAndStoreImage = async (card) => {
    const prompt = `${card.description}, in a cute cartoon style, vibrant colors, child-friendly, for a card game called "Terrible Teddies"`;
    try {
      console.log(`Generating image for ${card.name}`);
      const response = await fetch(PICO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PICO_API_KEY}`
        },
        body: JSON.stringify({
          prompt: prompt,
          negative_prompt: "realistic, photographic, human, person",
          width: 512,
          height: 512,
          num_inference_steps: 20,
          guidance_scale: 7.5,
          num_images: 1
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Image generated for ${card.name}`, data);
      const imageUrl = data.output[0];

      console.log(`Storing image for ${card.name}`);
      await Promise.all([
        addCardImage.mutateAsync({
          name: card.name,
          url: imageUrl,
          prompt: card.description,
          type: card.type,
          energy_cost: card.energyCost
        }),
        addGeneratedImage.mutateAsync({
          name: card.name,
          url: imageUrl,
          prompt: card.description,
          type: card.type,
          energy_cost: card.energyCost
        })
      ]);
      console.log(`Image stored for ${card.name}`);

      return imageUrl;
    } catch (error) {
      console.error(`Error generating image for ${card.name}:`, error);
      throw error;
    }
  };

  // ... (keep the rest of the component code)
}