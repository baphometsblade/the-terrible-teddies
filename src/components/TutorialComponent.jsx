import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

const tutorialSteps = [
  {
    title: "Welcome to Terrible Teddies!",
    content: "Terrible Teddies is a cute and strategic card battle game. Let's learn how to play!"
  },
  {
    title: "The Basics",
    content: "Each player starts with 30 HP and a deck of cards. Your goal is to reduce your opponent's HP to 0."
  },
  {
    title: "Card Types",
    content: "There are 5 types of cards: Action, Trap, Special, Defense, and Boost. Each type has unique effects."
  },
  {
    title: "Playing Cards",
    content: "During your turn, you can play cards from your hand. Each card costs energy to play."
  },
  {
    title: "Momentum Gauge",
    content: "The Momentum Gauge fills as you play cards. When it's full, your turn ends."
  },
  {
    title: "Winning the Game",
    content: "Reduce your opponent's HP to 0 to win! Good luck and have fun playing Terrible Teddies!"
  }
];

export const TutorialComponent = ({ onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="tutorial-component">
      <h2 className="text-2xl font-bold text-purple-800 mb-4">Tutorial</h2>
      <Card className="bg-white shadow-lg rounded-lg overflow-hidden">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-xl font-semibold mb-2">{tutorialSteps[currentStep].title}</h3>
              <p className="text-gray-600 mb-4">{tutorialSteps[currentStep].content}</p>
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-between mt-4">
            <Button onClick={prevStep} disabled={currentStep === 0}>Previous</Button>
            {currentStep < tutorialSteps.length - 1 ? (
              <Button onClick={nextStep}>Next</Button>
            ) : (
              <Button onClick={onExit}>Finish</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};