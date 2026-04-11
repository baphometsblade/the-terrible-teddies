import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { motion } from 'framer-motion';
import TeddyCard from './TeddyCard';

// All available teddies in the game
const ALL_TEDDIES = [
  // Action Cards
  { id: 1, name: "Teddy Troublemaker", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none', description: "A classic troublemaker who loves chaos." },
  { id: 2, name: "Sassy Sally", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt', description: "Forces enemies to attack her first." },
  { id: 3, name: "Pillow Fighter", attack: 4, defense: 1, type: 'action', cost: 3, ability: 'piercing', description: "Ignores enemy defense." },
  { id: 4, name: "Cuddle Crusher", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'shield', description: "Takes reduced damage." },
  { id: 5, name: "Sneaky Pete", attack: 3, defense: 1, type: 'action', cost: 2, ability: 'stealth', description: "Can't be targeted for one turn." },
  { id: 6, name: "Fluff Bomb", attack: 5, defense: 0, type: 'action', cost: 4, ability: 'none', description: "Maximum fluffing power!" },
  { id: 7, name: "Guardian Bear", attack: 1, defense: 5, type: 'action', cost: 3, ability: 'protect', description: "Protects other teddies." },
  { id: 8, name: "Rage Bear", attack: 4, defense: 2, type: 'action', cost: 3, ability: 'fury', description: "Gets stronger when damaged." },
  { id: 9, name: "Tiny Tim", attack: 1, defense: 1, type: 'action', cost: 1, ability: 'swarm', description: "Weak alone, strong together." },
  { id: 10, name: "Cotton King", attack: 3, defense: 3, type: 'action', cost: 4, ability: 'royal', description: "Buffs all friendly teddies." },

  // Trap Cards
  { id: 11, name: "Bear Trap", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3, description: "Deals 3 damage when triggered." },
  { id: 12, name: "Surprise Hug", attack: 0, defense: 0, type: 'trap', cost: 1, effect: 'damage', amount: 2, description: "A hug so tight it hurts!" },
  { id: 13, name: "Stuffing Explosion", attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4, description: "Explosive stuffing everywhere!" },

  // Special Cards
  { id: 14, name: "Stuffing Surge", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'heal', amount: 5, description: "Restore 5 HP." },
  { id: 15, name: "Honey Jar", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'draw', amount: 2, description: "Draw 2 cards." },
  { id: 16, name: "Button Eyes", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'draw', amount: 1, description: "See into the future, draw 1." },
  { id: 17, name: "Emergency Repair", attack: 0, defense: 0, type: 'special', cost: 4, effect: 'heal', amount: 8, description: "Major healing!" },
  { id: 18, name: "Teddy Rally", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'buff', amount: 1, description: "All teddies gain +1 attack." },
];

const TeddyCollection = () => {
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [filter, setFilter] = useState('all');

  const filteredTeddies = ALL_TEDDIES.filter(teddy => {
    if (filter === 'all') return true;
    return teddy.type === filter;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-white mb-6 text-center">
        Teddy Collection
      </h1>

      {/* Filter buttons */}
      <div className="flex justify-center gap-4 mb-8">
        {['all', 'action', 'trap', 'special'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`
              px-4 py-2 rounded-lg font-semibold transition-all
              ${filter === type
                ? 'bg-white text-purple-900'
                : 'bg-white/20 text-white hover:bg-white/30'
              }
            `}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
            <span className="ml-2 text-sm">
              ({ALL_TEDDIES.filter(t => type === 'all' || t.type === type).length})
            </span>
          </button>
        ))}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        {filteredTeddies.map((teddy, index) => (
          <motion.div
            key={teddy.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedTeddy(teddy)}
            className="cursor-pointer"
          >
            <TeddyCard
              teddy={teddy}
              isSelected={selectedTeddy?.id === teddy.id}
            />
          </motion.div>
        ))}
      </div>

      {/* Selected card details */}
      {selectedTeddy && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-black/90 p-6"
        >
          <div className="max-w-2xl mx-auto flex items-center gap-6">
            <TeddyCard teddy={selectedTeddy} />
            <div className="text-white flex-1">
              <h2 className="text-2xl font-bold mb-2">{selectedTeddy.name}</h2>
              <p className="text-gray-300 mb-4">{selectedTeddy.description}</p>
              <div className="flex gap-4 text-sm">
                <span className="bg-amber-500 px-2 py-1 rounded">
                  Type: {selectedTeddy.type}
                </span>
                <span className="bg-yellow-500 text-black px-2 py-1 rounded">
                  Cost: {selectedTeddy.cost}
                </span>
                {selectedTeddy.type === 'action' && (
                  <>
                    <span className="bg-red-500 px-2 py-1 rounded">
                      ATK: {selectedTeddy.attack}
                    </span>
                    <span className="bg-blue-500 px-2 py-1 rounded">
                      DEF: {selectedTeddy.defense}
                    </span>
                  </>
                )}
                {selectedTeddy.ability && selectedTeddy.ability !== 'none' && (
                  <span className="bg-purple-500 px-2 py-1 rounded">
                    Ability: {selectedTeddy.ability}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedTeddy(null)}
              className="text-white text-2xl hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TeddyCollection;
