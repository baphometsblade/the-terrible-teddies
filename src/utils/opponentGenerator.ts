import { TeddyCard } from '../types/types';

export const generateOpponent = (wave: number): TeddyCard => {
  const baseStat = 10 + wave * 2;
  const randomVariation = () => Math.floor(Math.random() * 5) - 2; // -2 to +2

  return {
    id: `opponent-${wave}`,
    name: `Wave ${wave} Boss`,
    attack: baseStat + randomVariation(),
    defense: baseStat + randomVariation(),
    health: 100 + wave * 10,
    energy: 3,
    level: wave,
    experience: 0,
    special_move: `Wave ${wave} Special`,
    image_url: `https://example.com/teddy-${wave}.png`, // Replace with actual image URL generation logic
  };
};