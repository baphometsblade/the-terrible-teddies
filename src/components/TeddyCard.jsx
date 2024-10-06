import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from 'framer-motion';
import { Tooltip } from "@/components/ui/tooltip";

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
          <img src={teddy.imageUrl} alt={teddy.name} className="w-full h-48 object-cover rounded mb-4" />
          <p className="text-sm text-gray-600 mb-2">{teddy.title}</p>
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