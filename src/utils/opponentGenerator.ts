import { TeddyCard } from '../types/types';

const specialMoves = [
  'Furry Fury',
  'Cuddle Crush',
  'Stuffing Slam',
  'Button Barrage',
  'Seam Ripper',
];

export const generateOpponent = (wave: number): TeddyCard => {
  const baseStat = 10 + wave * 2;
  const randomVariation = () => Math.floor(Math.random() * 5) - 2; // -2 to +2

  const attack = baseStat + randomVariation();
  const defense = baseStat + randomVariation();
  const health = 100 + wave * 10;
  const energy = 3 + Math.floor(wave / 5); // Increase energy every 5 waves

  const specialMoveIndex = Math.floor(Math.random() * specialMoves.length);

  return {
    id: `opponent-${wave}`,
    name: `Wave ${wave} Boss`,
    attack,
    defense,
    health,
    energy,
    level: wave,
    experience: 0,
    special_move: specialMoves[specialMoveIndex],
    image_url: `https://example.com/teddy-${wave}.png`, // Replace with actual image URL generation logic
  };
};