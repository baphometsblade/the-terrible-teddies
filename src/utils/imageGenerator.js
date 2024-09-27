import axios from 'axios';
import { supabase } from '../lib/supabase';

const PERPLEXITY_API_KEY = import.meta.env.VITE_PERPLEXITYAI_API_KEY;

export const generateTeddyImage = async (teddyName, teddyDescription) => {
  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'pplx-7b-online',
        messages: [
          {
            role: 'system',
            content: 'You are an AI that generates image descriptions for teddy bears.'
          },
          {
            role: 'user',
            content: `Create a detailed image description for a cheeky, adult-themed teddy bear named ${teddyName}. ${teddyDescription}. The image should be hyper-realistic, ultra-detailed, and suitable for a card game. Make it visually striking and slightly provocative, perfect for an adult audience.`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const imageDescription = response.data.choices[0].message.content;

    // Here you would typically use this description to generate an actual image
    // For now, we'll return a placeholder URL
    return `https://via.placeholder.com/300x300?text=${encodeURIComponent(teddyName)}`;
  } catch (error) {
    console.error('Error generating teddy image description:', error);
    return null;
  }
};

export const generateBackgroundImage = async (theme) => {
  // Similar implementation as generateTeddyImage, but for backgrounds
  // For now, we'll return a placeholder URL
  return `https://via.placeholder.com/1024x1024?text=${encodeURIComponent(theme)}`;
};