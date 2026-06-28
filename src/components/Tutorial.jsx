import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useDialog } from '@/hooks/useDialog';

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Terrible Teddies!",
    content: "A naughty card battling game where mischievous teddy bears fight for supremacy!",
    icon: "🧸",
  },
  {
    title: "Your Goal",
    content: "Reduce your opponent's HP to 0 before they do the same to you. Each player starts with 30 HP.",
    icon: "🎯",
  },
  {
    title: "Turn Phases",
    content: "Each turn has phases:\n1. Draw Phase - Draw a card\n2. Main Phase - Play cards\n3. Battle Phase - Attack!\n4. End Phase - End your turn",
    icon: "🔄",
  },
  {
    title: "Card Types",
    content: "Action Cards - Your fighting teddies with Attack and Defense stats\nTrap Cards - Surprise! Deal damage when attacked\nSpecial Cards - Heal HP or draw more cards",
    icon: "🃏",
    showCards: true,
  },
  {
    title: "Energy System",
    content: "Playing cards costs energy (shown in yellow). You start with 3 energy per turn, increasing as the game progresses.",
    icon: "⚡",
  },
  {
    title: "Card Abilities",
    content: "Taunt - Must be attacked first\nPiercing - Ignores defense\nShield - Takes 50% less damage\nStealth - Can't be targeted for a turn\nFury - Gets stronger when damaged",
    icon: "✨",
  },
  {
    title: "Combat",
    content: "In Battle Phase, click your teddy, then click an enemy to attack. If no enemies remain, attack the opponent directly!",
    icon: "⚔️",
  },
  {
    title: "Momentum",
    content: "Build momentum by playing cards and attacking. Future updates will add powerful momentum abilities!",
    icon: "🚀",
  },
  {
    title: "Ready to Battle!",
    content: "You're ready to take on the Evil Teddies! Good luck, and may the fluffiest bear win!",
    icon: "🏆",
  },
];

const exampleCards = [
  { id: 1, name: "Sassy Sally", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt' },
  { id: 2, name: "Bear Trap", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3 },
  { id: 3, name: "Stuffing Surge", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'heal', amount: 5 },
];

const Tutorial = ({ onClose, onStartGame }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = TUTORIAL_STEPS[currentStep];
  const dialogRef = useDialog(onClose);

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-purple-900 to-indigo-900 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-purple-800 p-4 flex justify-between items-center">
          <h2 className="text-white font-bold text-xl">How to Play</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl"
            aria-label="Close tutorial"
          >
            ×
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 py-4 bg-purple-800/50">
          {TUTORIAL_STEPS.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentStep
                  ? 'bg-yellow-400 scale-125'
                  : index < currentStep
                  ? 'bg-green-400'
                  : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-8 min-h-[300px]"
          >
            <div className="text-center mb-6">
              <span className="text-6xl">{step.icon}</span>
            </div>

            <h3 className="text-2xl font-bold text-white text-center mb-4">
              {step.title}
            </h3>

            <p className="text-purple-200 text-center whitespace-pre-line leading-relaxed">
              {step.content}
            </p>

            {/* Show example cards for card types step */}
            {step.showCards && (
              <div className="flex justify-center gap-4 mt-6">
                {exampleCards.map(card => (
                  <div key={card.id} className="transform scale-90">
                    <TeddyCard teddy={card} />
                    <div className="text-center text-xs text-purple-300 mt-1">
                      {card.type.charAt(0).toUpperCase() + card.type.slice(1)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="bg-purple-800/50 p-4 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="text-white border-white/30 hover:bg-white/10"
          >
            ← Previous
          </Button>

          <span className="text-white/50 text-sm">
            {currentStep + 1} / {TUTORIAL_STEPS.length}
          </span>

          {isLastStep ? (
            <Button
              onClick={onStartGame}
              className="bg-green-500 hover:bg-green-600"
            >
              Start Playing! 🎮
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              Next →
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Tutorial;
