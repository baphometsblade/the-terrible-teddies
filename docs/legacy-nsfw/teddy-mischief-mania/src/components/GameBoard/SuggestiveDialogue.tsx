
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Heart, Flame, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuggestiveDialogueProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "naughty" | "nasty";
  dialogueType?: "seduction" | "domination" | "teasing" | "punishment";
  intensity?: number;
  duration?: number;
  showCloseButton?: boolean;
}

export function SuggestiveDialogue({
  isOpen,
  onClose,
  mode,
  dialogueType = "seduction",
  intensity = 5,
  duration = 5000,
  showCloseButton = true
}: SuggestiveDialogueProps) {
  const [dialogue, setDialogue] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);
  
  // Set up dialogue based on mode and type
  useEffect(() => {
    if (!isOpen) return;
    
    const naughtyDialogues = {
      seduction: [
        "Mmm, I like how you play...",
        "Let me show you how soft I can be...",
        "Want to feel my plush fur?",
        "I'll make you blush with my cuddles",
        "Your teddy knows what you like...",
        "Let me whisper sweet nothings in your ear...",
        "My stuffing gets all excited when you play with me",
        "I'll be your favorite bedtime companion",
        "No one cuddles like I do..."
      ],
      domination: [
        "You're going to do exactly what I say...",
        "Your teddy is in charge now",
        "On your knees, plaything",
        "You belong to me now",
        "I'll make you beg for more cuddles",
        "Surrender to your teddy overlord",
        "Your resistance only makes my stuffing firmer",
        "You're mine to play with as I please"
      ],
      teasing: [
        "Just a little taste of what's to come...",
        "You want more? You'll have to earn it",
        "So close, yet so far away...",
        "I know exactly what you want...",
        "Patience is a virtue, but I'm not very virtuous",
        "I'll make you wait for the good stuff",
        "The anticipation is half the fun"
      ],
      punishment: [
        "You've been a naughty little player...",
        "Time for your teddy to teach you a lesson",
        "This will hurt you more than it hurts me...",
        "I'll make sure you never misbehave again",
        "Your teddy knows best",
        "Accept your punishment like a good little player"
      ]
    };
    
    const nastyDialogues = {
      seduction: [
        "I'll tear you apart... with pleasure",
        "Let me show you what these claws can do",
        "Your stuffing will be mine",
        "I'm going to wear your fur like a trophy",
        "You'll be begging for mercy... in a good way"
      ],
      domination: [
        "I own you now, teddy",
        "Your stuffing belongs to me",
        "Bow before your superior",
        "I'll rip out your stuffing slowly",
        "Your defeat was inevitable"
      ],
      teasing: [
        "That's just a taste of the pain to come",
        "You think that hurt? Just wait...",
        "I'm just warming up my claws",
        "The real suffering begins now",
        "This is going to be a long, painful game"
      ],
      punishment: [
        "Time to pay for your mistakes",
        "I'll make an example of you",
        "Your stuffing will decorate my lair",
        "This is what happens to those who challenge me",
        "Your screams are music to my ears"
      ]
    };
    
    // Select dialogues based on mode
    const dialogues = mode === "naughty" ? naughtyDialogues : nastyDialogues;
    
    // Select a random dialogue from the appropriate category
    const options = dialogues[dialogueType];
    const message = options[Math.floor(Math.random() * options.length)];
    
    setDialogue(message);
    setIsVisible(true);
    
    // Auto-close after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose();
      }, 300); // Allow exit animation to complete
    }, duration);
    
    return () => clearTimeout(timer);
  }, [isOpen, mode, dialogueType, duration, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={showCloseButton ? onClose : undefined}
          />
          
          <motion.div
            className={cn(
              "relative max-w-md p-6 rounded-xl shadow-lg",
              mode === "naughty" 
                ? "bg-gradient-to-br from-rose-950/90 to-rose-900/90 border-2 border-rose-500/30" 
                : "bg-gradient-to-br from-violet-950/90 to-violet-900/90 border-2 border-violet-500/30"
            )}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white/70 hover:text-white hover:bg-white/10"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            
            <div className="flex items-start gap-4">
              {mode === "naughty" ? (
                <Heart className="w-10 h-10 text-rose-500 animate-pulse" />
              ) : (
                <Flame className="w-10 h-10 text-violet-500 animate-pulse" />
              )}
              
              <div className="flex-1">
                <h3 
                  className={cn(
                    "text-lg font-semibold mb-2",
                    mode === "naughty" ? "text-rose-200" : "text-violet-200"
                  )}
                >
                  {dialogueType === "seduction" && "Seductive Whisper"}
                  {dialogueType === "domination" && "Dominating Command"}
                  {dialogueType === "teasing" && "Teasing Taunt"}
                  {dialogueType === "punishment" && "Punishing Decree"}
                </h3>
                
                <p className="text-white/90 italic">
                  "{dialogue}"
                </p>
                
                <div 
                  className={cn(
                    "mt-4 h-1 rounded-full overflow-hidden",
                    mode === "naughty" ? "bg-rose-800" : "bg-violet-800"
                  )}
                >
                  <motion.div
                    className={
                      mode === "naughty" ? "bg-rose-500" : "bg-violet-500"
                    }
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: duration / 1000, ease: "linear" }}
                    style={{ height: "100%" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
