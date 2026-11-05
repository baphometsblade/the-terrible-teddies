
import { TeddyCard } from "@/lib/types";
import { determineBearPersonality } from "@/utils/cardUtils";
import { GameMode } from "@/lib/types/battleTypes";

// Seduction mechanics add a unique layer to gameplay in naughty mode
type SeductionEffect = {
  target: 'opponent' | 'self';
  effect: 'charmed' | 'distracted' | 'aroused' | 'infatuated';
  duration: number; // in turns
  intensity: number; // 1-10 scale
  description: string;
};

// Calculate if a seduction attempt is successful
export const calculateSeductionSuccess = (
  seducer: TeddyCard,
  target: TeddyCard,
  gameMode: GameMode
): boolean => {
  // Base seduction chance from fluff stat
  const baseChance = gameMode === 'naughty' ? 
    seducer.fluff * 8 : // Fluff is more powerful in naughty mode
    seducer.fluff * 5;  // Less effective in nasty mode
  
  // Target's resistance based on defense and personality
  const targetPersonality = determineBearPersonality(target);
  let resistance = target.defense * 5;
  
  // Personality adjustments
  if (targetPersonality === 'naughty') {
    resistance *= 0.8; // Naughty bears are more susceptible to seduction
  } else if (targetPersonality === 'nasty') {
    resistance *= 1.2; // Nasty bears are more resistant to seduction
  }
  
  // Calculate final chance with randomness
  const finalChance = baseChance / (resistance + 5);
  const roll = Math.random();
  
  return roll < finalChance;
};

// Generate a seduction effect when successful
export const generateSeductionEffect = (
  seducer: TeddyCard,
  target: TeddyCard,
  gameMode: GameMode
): SeductionEffect => {
  const seducerPersonality = determineBearPersonality(seducer);
  const effects: string[] = ['charmed', 'distracted', 'aroused', 'infatuated'];
  
  // Select effect based on seducer's personality and game mode
  let selectedEffect: string;
  
  if (gameMode === 'naughty') {
    if (seducerPersonality === 'naughty') {
      // Naughty bears in naughty mode prefer arousal and infatuation
      selectedEffect = Math.random() > 0.5 ? 'aroused' : 'infatuated';
    } else {
      // Nasty bears in naughty mode prefer charming and distraction
      selectedEffect = Math.random() > 0.5 ? 'charmed' : 'distracted';
    }
  } else {
    // In nasty mode, effects are more about control
    selectedEffect = Math.random() > 0.5 ? 'charmed' : 'distracted';
  }
  
  // Calculate duration and intensity based on fluff and game mode
  const baseDuration = Math.floor(seducer.fluff / 3) + 1;
  const baseIntensity = Math.min(Math.floor(seducer.fluff / 2) + 1, 10);
  
  // Generate appropriate description
  const descriptions = {
    charmed: [
      `${target.name} is captivated by ${seducer.name}'s allure.`,
      `${target.name} can't help but follow ${seducer.name}'s every command.`,
      `${target.name} is completely under ${seducer.name}'s spell.`
    ],
    distracted: [
      `${target.name} can't stop staring at ${seducer.name}.`,
      `${target.name} loses focus, mesmerized by ${seducer.name}'s movements.`,
      `${target.name} is too distracted to concentrate on the battle.`
    ],
    aroused: [
      `${target.name} feels a rush of desire for ${seducer.name}.`,
      `${target.name} is overwhelmed with passion, making it hard to think clearly.`,
      `${target.name} burns with longing for ${seducer.name}'s touch.`
    ],
    infatuated: [
      `${target.name} has fallen completely for ${seducer.name}.`,
      `${target.name} would do anything to please ${seducer.name} now.`,
      `${target.name} is hopelessly devoted to ${seducer.name}.`
    ]
  };
  
  const randomDescriptionIndex = Math.floor(Math.random() * 3);
  
  return {
    target: 'opponent',
    effect: selectedEffect as 'charmed' | 'distracted' | 'aroused' | 'infatuated',
    duration: baseDuration,
    intensity: baseIntensity,
    description: descriptions[selectedEffect as keyof typeof descriptions][randomDescriptionIndex]
  };
};

// Get gameplay effects based on seduction status
export const getSeductionGameplayEffect = (
  effect: SeductionEffect,
  gameMode: GameMode
): { statModifier: number; actionModifier: number; description: string } => {
  // Base effect values
  let statModifier = 0;
  let actionModifier = 0;
  let effectDescription = "";
  
  // Calculate effects based on type and intensity
  switch(effect.effect) {
    case 'charmed':
      statModifier = -effect.intensity * 0.1;
      actionModifier = -0.2;
      effectDescription = "Reduces all stats and chance to play cards";
      break;
    case 'distracted':
      statModifier = 0;
      actionModifier = -0.3;
      effectDescription = "Significantly reduces chance to play cards";
      break;
    case 'aroused':
      statModifier = -effect.intensity * 0.15;
      actionModifier = 0;
      effectDescription = "Greatly reduces all stats";
      break;
    case 'infatuated':
      statModifier = -effect.intensity * 0.2;
      actionModifier = -0.1;
      effectDescription = "Severely reduces all stats and slightly reduces chance to play cards";
      break;
    default:
      break;
  }
  
  // Adjust based on game mode
  if (gameMode === 'nasty') {
    // Seduction effects are less powerful in nasty mode
    statModifier *= 0.7;
    actionModifier *= 0.7;
  }
  
  return {
    statModifier,
    actionModifier,
    description: effectDescription
  };
};

// Generate seductive dialogue
export const getSeductiveDialogue = (
  seducer: TeddyCard,
  target: TeddyCard,
  effect: SeductionEffect,
  gameMode: GameMode
): string => {
  const seducerName = seducer.name;
  const targetName = target.name;
  
  const dialogues = {
    naughty: {
      charmed: [
        `"Look into my eyes," ${seducerName} purrs, and ${targetName} can't look away.`,
        `${seducerName} blows a kiss that leaves ${targetName} completely entranced.`,
        `${targetName} is putty in ${seducerName}'s paws after that flirtatious display.`
      ],
      distracted: [
        `${seducerName} performs a tantalizing dance that ${targetName} can't stop watching.`,
        `${targetName} loses all focus as ${seducerName} suggestively licks their lips.`,
        `"Is it hot in here?" ${seducerName} asks, making ${targetName} fumble their next move.`
      ],
      aroused: [
        `${targetName} blushes deeply as ${seducerName} whispers exactly what they'd like to do after the battle.`,
        `"Do you feel it too?" ${seducerName} asks, making ${targetName} weak with desire.`,
        `${seducerName} traces a paw slowly down their own body, leaving ${targetName} breathless.`
      ],
      infatuated: [
        `"I think I'm in love," ${targetName} confesses after ${seducerName}'s seductive display.`,
        `${targetName} would do anything for just one more moment of ${seducerName}'s attention.`,
        `${seducerName} has completely stolen ${targetName}'s heart with that move.`
      ]
    },
    nasty: {
      charmed: [
        `${seducerName} dominates ${targetName}'s will with unrelenting eye contact.`,
        `"You belong to me now," ${seducerName} commands, and ${targetName} can't help but obey.`,
        `${targetName}'s resistance crumbles under ${seducerName}'s forceful personality.`
      ],
      distracted: [
        `${seducerName} flashes just enough to make ${targetName} completely lose focus.`,
        `${targetName} is caught off-guard by ${seducerName}'s unexpected display of skin.`,
        `"Look what I can do," ${seducerName} says, performing a move that leaves ${targetName} stunned.`
      ],
      aroused: [
        `${seducerName} roughly grabs ${targetName}, leaving them flustered and wanting more.`,
        `"I know exactly what you need," ${seducerName} growls, making ${targetName} shiver with anticipation.`,
        `${targetName} can't hide their physical reaction to ${seducerName}'s dominant display.`
      ],
      infatuated: [
        `${seducerName} breaks ${targetName}'s will and replaces it with unconditional devotion.`,
        `"You're mine now," ${seducerName} declares, and ${targetName} wouldn't have it any other way.`,
        `${targetName} pledges their complete loyalty to ${seducerName} after that display of power.`
      ]
    }
  };
  
  const mode = gameMode === 'naughty' ? 'naughty' : 'nasty';
  const dialogueOptions = dialogues[mode][effect.effect];
  return dialogueOptions[Math.floor(Math.random() * dialogueOptions.length)];
};
