import { Element } from '../types/types';

export interface TeddyMetadata {
  id: string;
  name: string;
  title: string;
  description: string;
  element: Element;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  attack: number;
  defense: number;
  specialMove: string;
  specialMoveDescription: string;
  imageUrl: string;
  placeholderImage: string;
}