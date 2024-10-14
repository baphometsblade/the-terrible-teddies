import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from 'framer-motion';
import { Tooltip } from "@/components/ui/tooltip";
import { ImageOff } from 'lucide-react';

const TeddyCard = ({ teddy }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card className="w-full max-w-sm bg-white shadow-lg rounded-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <CardTitle>{teddy.name}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="relative w-full h-48 mb-4 overflow-hidden rounded-lg bg-gray-200">
            {teddy.imageUrl ? (
              <img 
                src={teddy.imageUrl} 
                alt={teddy.name} 
                className="absolute inset-0 w-full h-full object-cover transform hover:scale-110 transition-transform duration-300 ease-in-out"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/300x200?text=Image+Not+Available';
                }}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <ImageOff className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-50"></div>
            <p className="absolute bottom-2 left-2 text-white text-sm font-bold">{teddy.title}</p>
          </div>
          <p className="text-sm mb-4">{teddy.description}</p>
          <div className="flex justify-between mb-2">
            <Badge variant="secondary">Attack: {teddy.attack}</Badge>
            <Badge variant="secondary">Defense: {teddy.defense}</Badge>
          </div>
          <Tooltip content={teddy.specialAbilityDescription}>
            <p className="mt-2 text-sm font-semibold cursor-help">Special Ability: {teddy.specialAbility}</p>
          </Tooltip>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TeddyCard;