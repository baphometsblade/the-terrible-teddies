import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

const tutorialSteps = [
  {
    title: "Welcome to Terrible Teddies!",
    content: "Get ready for the most hilariously naughty card battle game you've ever played! These teddies are anything but cuddly."
  },
  {
    title: "The Basics of Mischief",
    content: "Each player starts with 30 HP and a deck of troublemaking teddies. Your goal? Reduce your opponent's HP to 0 using the most outrageous tactics possible!"
  },
  {
    title: "Types of Trouble",
    content: "You have three types of cards to cause mayhem: Naughty Teddies, Devious Actions, and Ridiculous Items. Each one brings its own flavor of chaos to the game."
  },
  {
    title: "Unleashing Chaos",
    content: "During your turn, play cards from your hand to attack your opponent, boost your defenses, or pull off hilarious pranks. The more outrageous, the better!"
  },
  {
    title: "Special Abilities",
    content: "Each Teddy has a unique special ability. From 'Tickle Attacks' to 'Stink Bomb Surprises', use these to catch your opponent off guard and turn the tide of battle."
  },
  {
    title: "Winning the Game",
    content: "Reduce your opponent's HP to 0 to win! Remember, in Terrible Teddies, it's not just about winning - it's about winning with style and a whole lot of laughter!"
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
      <h2 className="text-2xl font-bold text-purple-800 mb-4">How to Cause Mischief</h2>
      <Card className="bg-gradient-to-r from-pink-100 to-purple-100 shadow-lg rounded-lg overflow-hidden">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-xl font-semibold mb-2 text-purple-700">{tutorialSteps[currentStep].title}</h3>
              <p className="text-purple-600 mb-4">{tutorialSteps[currentStep].content}</p>
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-between mt-4">
            <Button onClick={prevStep} disabled={currentStep === 0} className="bg-blue-500 hover:bg-blue-600 text-white">Previous Mischief</Button>
            {currentStep < tutorialSteps.length - 1 ? (
              <Button onClick={nextStep} className="bg-green-500 hover:bg-green-600 text-white">Next Prank</Button>
            ) : (
              <Button onClick={onExit} className="bg-purple-500 hover:bg-purple-600 text-white">Start Trouble!</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};