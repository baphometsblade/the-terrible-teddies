import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { useUserCards } from '../hooks/useUserCards';
import { LoadingSpinner } from './LoadingSpinner';

export const CardCollection = ({ onClose }) => {
  const { data: cards, isLoading, error } = useUserCards();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error loading cards: {error.message}</div>;

  const filteredCards = cards.filter(card => 
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="card-collection p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg shadow-xl"
    >
      <h2 className="text-3xl font-bold mb-6 text-center text-purple-800">Your Terrible Teddies Collection</h2>
      <Input
        type="text"
        placeholder="Search cards..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCards.map((card) => (
          <motion.div
            key={card.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Card className="bg-white shadow-lg">
              <CardContent className="p-4">
                <img src={card.url} alt={card.name} className="w-full h-32 object-cover mb-2 rounded" />
                <h3 className="text-lg font-semibold mb-1 text-purple-700">{card.name}</h3>
                <p className="text-sm mb-1 text-purple-600">{card.type}</p>
                <p className="text-xs text-gray-600">{card.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <Button onClick={onClose} className="mt-6 bg-purple-500 hover:bg-purple-600 text-white">
        Close Collection
      </Button>
    </motion.div>
  );
};