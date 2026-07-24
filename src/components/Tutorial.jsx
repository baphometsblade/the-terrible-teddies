import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';
import { useDialog } from '@/hooks/useDialog';

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Terrible Teddies",
    content: "Somewhere between the toy chest and the bar, these teddies went bad. Now they settle everything with cards, fists, and language you can't repeat at work.\n\n(18+ — crude humor, cartoon fluff violence, and bears with substance-abuse issues.)",
    icon: "🧸",
  },
  {
    title: "The Job",
    content: "Beat the stuffing out of Chuck — the smuggest teddy alive — by getting his 30 HP to 0 before your 30 HP hits the floor. He WILL talk trash the entire time. Ignore him. Or don't. He hates both.",
    icon: "🎯",
  },
  {
    title: "How a Turn Works",
    content: "1. Draw — take a card. It's probably a bad one. Play it anyway.\n2. Main — throw teddies and traps on the table\n3. Battle — the fun part\n4. End — Chuck's turn to embarrass himself",
    icon: "🔄",
  },
  {
    title: "The Cast",
    content: "Action Cards — your goons, with Attack (⚔️) and HP (🛡️). HP is how many beatings they can absorb before going back to fluff.\nTrap Cards — spring-loaded regret for whoever swings at you\nSpecial Cards — back-alley healing and questionable card advantage",
    icon: "🃏",
    showCards: true,
  },
  {
    title: "Energy",
    content: "Cards cost energy (the yellow number). You start each turn with 3 and it climbs as the game drags on — just like a real bar tab.",
    icon: "⚡",
  },
  {
    title: "Rap Sheets (Abilities)",
    content: "Taunt — talks so much shit, enemies HAVE to hit them first\nPiercing — cuts straight through Shield\nShield — takes 50% less damage, the coward\nStealth — untargetable for a turn (currently hiding in your hamper)\nFury — every hit they survive is +1 Attack. Do NOT keep poking them.",
    icon: "✨",
  },
  {
    title: "Violence 101",
    content: "Click your teddy, then a victim. Damage comes off the target's HP — they stay on the table until it hits 0, and any leftover damage tramples straight into their owner's face. Big-HP teddies are bouncers: get past them (or bring Piercing) before you can deck Chuck directly.",
    icon: "⚔️",
  },
  {
    title: "Momentum & Rally",
    content: "Playing cards and throwing hands builds Momentum. Fill the gauge to 10 and the ⚡ Rally button lights up — cash it in and your whole squad gets +1 Attack and a full restuff. It's the comeback button, and Chuck thinks it should be illegal.",
    icon: "🚀",
  },
  {
    title: "Go Ruin Chuck's Day",
    content: "That's everything. Get out there, talk your talk, and remember the house rule: no biting. (Biting is fine.)",
    icon: "🏆",
  },
];

const exampleCards = [
  { id: 1, name: "Shit-Talk Sally", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt' },
  { id: 2, name: "Honey Trap", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3 },
  { id: 3, name: "Emergency Fluff Job", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'heal', amount: 5 },
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
