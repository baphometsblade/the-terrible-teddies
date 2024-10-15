import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, Star } from 'lucide-react';

const TeddyTraits = ({ teddy }) => {
  const traits = [
    { name: 'Strength', value: teddy.attack, icon: <Zap className="w-4 h-4" /> },
    { name: 'Defense', value: teddy.defense, icon: <Shield className="w-4 h-4" /> },
    { name: 'Special', value: teddy.specialAbility.name, icon: <Star className="w-4 h-4" /> },
  ];

  return (
    <motion.div
      className="teddy-traits bg-gray-100 p-4 rounded-lg shadow-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold mb-2">{teddy.name}'s Traits</h3>
      <div className="grid grid-cols-3 gap-2">
        {traits.map((trait, index) => (
          <div key={index} className="flex items-center">
            {trait.icon}
            <span className="ml-2">{trait.name}: {trait.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default TeddyTraits;