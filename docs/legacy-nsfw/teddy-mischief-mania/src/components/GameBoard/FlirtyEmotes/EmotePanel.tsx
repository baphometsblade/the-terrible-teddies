
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { 
  Heart, Flame, SmilePlus, ThumbsUp, Sparkles, Laugh, 
  MessageCircleHeart, Zap, Droplet, Cherry, Scissors,
  Sword, Bomb, Skull, BadgeAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GameMode } from "@/lib/types/battleTypes";

interface EmotePanelProps {
  gameMode: GameMode;
  onEmote: (emote: string, message: string) => void;
}

export const EmotePanel = ({ gameMode, onEmote }: EmotePanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleEmote = (emote: string, message: string) => {
    onEmote(emote, message);
    toast.success(`Sent: ${emote}`, {
      description: message,
      duration: 2000
    });
    setIsOpen(false);
  };
  
  const emotes = gameMode === "naughty" 
    ? [
        { icon: Heart, name: "Flirt", message: "Hey there, looking good..." },
        { icon: Sparkles, name: "Tease", message: "You're in for a special treat" },
        { icon: MessageCircleHeart, name: "Sweet Talk", message: "Your moves make me weak..." },
        { icon: SmilePlus, name: "Seduce", message: "Let me show you what I can do" },
        { icon: Laugh, name: "Giggle", message: "That tickles in all the right places!" },
        { icon: Cherry, name: "Wink", message: "I've got something special for you" },
        { icon: Droplet, name: "Drool", message: "You're making me all excited..." },
        { icon: Zap, name: "Tingle", message: "Feeling a little spark between us?" },
      ]
    : [
        { icon: Flame, name: "Taunt", message: "Is that all you've got?" },
        { icon: ThumbsUp, name: "Dominate", message: "Know your place!" },
        { icon: Sparkles, name: "Intimidate", message: "You're about to feel real pain" },
        { icon: MessageCircleHeart, name: "Mock", message: "That pathetic move won't save you" },
        { icon: SmilePlus, name: "Growl", message: "Prepare for destruction!" },
        { icon: Sword, name: "Threaten", message: "I'll tear you to shreds!" },
        { icon: Bomb, name: "Explode", message: "Watch your stuffing fly everywhere!" },
        { icon: Skull, name: "Doom", message: "Your end is near, teddy..." },
        { icon: BadgeAlert, name: "Warning", message: "You'll regret that move..." },
      ];
  
  return (
    <div className="fixed bottom-24 left-4 z-30">
      <motion.button
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center shadow-lg",
          gameMode === "naughty" 
            ? "bg-rose-600 text-white hover:bg-rose-700" 
            : "bg-violet-600 text-white hover:bg-violet-700"
        )}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Emote menu"
      >
        {gameMode === "naughty" ? <Heart className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
      </motion.button>
      
      <AnimatedEmoteMenu isOpen={isOpen} emotes={emotes} gameMode={gameMode} onSelect={handleEmote} />
    </div>
  );
};

interface EmoteMenuProps {
  isOpen: boolean;
  emotes: Array<{ icon: any; name: string; message: string }>;
  gameMode: GameMode;
  onSelect: (emote: string, message: string) => void;
}

const AnimatedEmoteMenu = ({ isOpen, emotes, gameMode, onSelect }: EmoteMenuProps) => {
  if (!isOpen) return null;
  
  return (
    <motion.div
      className={cn(
        "absolute bottom-16 left-0 p-2 rounded-lg shadow-xl backdrop-blur-sm",
        gameMode === "naughty" 
          ? "bg-rose-950/80 border border-rose-500/30" 
          : "bg-violet-950/80 border border-violet-500/30"
      )}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
    >
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {emotes.map((emote, index) => (
          <motion.button
            key={emote.name}
            className={cn(
              "flex items-center gap-2 py-2 px-3 rounded-lg text-left whitespace-nowrap",
              gameMode === "naughty" 
                ? "hover:bg-rose-800/50 text-rose-100" 
                : "hover:bg-violet-800/50 text-violet-100"
            )}
            onClick={() => onSelect(emote.name, emote.message)}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <emote.icon className="w-4 h-4" />
            <span className="text-sm font-medium">{emote.name}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};
