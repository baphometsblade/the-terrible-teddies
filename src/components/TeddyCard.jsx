import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

const TeddyCard = ({ teddy, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card className="w-64 h-96 bg-gradient-to-b from-gray-800 to-gray-900 text-white cursor-pointer" onClick={onClick}>
        <CardContent className="p-4 flex flex-col h-full">
          <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-40 object-cover rounded-lg mb-4" />
          <h3 className="text-xl font-bold mb-2">{teddy.name}</h3>
          <p className="text-sm italic mb-2">{teddy.title}</p>
          <div className="flex justify-between mb-2">
            <Badge variant="destructive">ATK: {teddy.attack}</Badge>
            <Badge variant="secondary">DEF: {teddy.defense}</Badge>
          </div>
          <p className="text-sm mb-2">Special: {teddy.specialMove}</p>
          <p className="text-xs italic mt-auto">{teddy.description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TeddyCard;