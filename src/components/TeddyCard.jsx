import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

export const TeddyCard = ({ teddy, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card className="w-48 bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-300 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardContent className="p-4">
          <img src={teddy.url} alt={teddy.name} className="w-full h-32 object-cover rounded mb-2 mx-auto" />
          <h3 className="text-lg font-bold mb-1 text-purple-800">{teddy.name}</h3>
          <p className="text-sm mb-1 text-purple-600">Type: {teddy.type}</p>
          <p className="text-sm mb-1 text-purple-700">Energy Cost: {teddy.energy_cost}</p>
          <p className="text-xs italic mb-2 text-purple-600">{teddy.effect}</p>
          <Button onClick={onClick} className="w-full bg-purple-500 hover:bg-purple-600 text-white">Play Card</Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
