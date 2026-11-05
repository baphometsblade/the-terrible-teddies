
import { GameMode } from "@/lib/types/battleTypes";

// Card name generation helpers
const naughtySuffixes = [
  "Seducer",
  "Teaser",
  "Lover",
  "Stroker",
  "Pleaser",
  "Whisper",
  "Caresser",
  "Kisser",
  "Cuddler",
  "Fondler",
  "Charmer",
  "Tempter",
  "Enchanter",
  "Wooer",
  "Temptress"
];

const nastySuffixes = [
  "Dominator",
  "Punisher",
  "Destroyer",
  "Ripper",
  "Breaker",
  "Shredder",
  "Crusher",
  "Bruiser",
  "Violator",
  "Torturer",
  "Masher",
  "Smasher",
  "Ravager",
  "Slasher",
  "Thruster"
];

const naughtyPrefixes = [
  "Silky",
  "Gentle",
  "Tender",
  "Soft",
  "Smooth",
  "Sensual",
  "Sweet",
  "Velvet",
  "Fluffy",
  "Plush",
  "Intimate",
  "Passionate",
  "Arousing",
  "Flirty",
  "Honey"
];

const nastyPrefixes = [
  "Rough",
  "Fierce",
  "Brutal",
  "Hard",
  "Sharp",
  "Savage",
  "Violent",
  "Cruel",
  "Merciless",
  "Primal",
  "Aggressive",
  "Forceful",
  "Wild",
  "Intense",
  "Ruthless"
];

// Extremely suggestive card names with double meanings
const suggestiveNames = [
  "Velvet Pounder",
  "Stuffing Spreader",
  "Honey Dripper",
  "Midnight Rider",
  "Deep Penetrator",
  "Fur Tickler",
  "The Stimulator",
  "Innocent Deceiver",
  "Pleasure Provider",
  "Passionate Shaker",
  "Cotton Swallower",
  "Backdoor Explorer",
  "Tight Squeezer",
  "Multiple Pleaser",
  "Wet Dreamer",
  "Teddy Teabagger",
  "The Vibrator",
  "Zipper Opener",
  "Fur Stroker",
  "Fluff Puncher",
  "Button Poker",
  "Bean Flicker"
];

// Domination-themed names with adult themes
const dominationNames = [
  "Pain Giver",
  "Submission Force",
  "The Dominatrix",
  "Chain Master",
  "Safety Word",
  "Whip Cracker",
  "Leather Slapper",
  "Fur Puller",
  "Restraint King",
  "Throat Grabber",
  "The Punisher",
  "Forced Entry",
  "No Consent",
  "Ball Buster",
  "Choker" 
];

// Generate a random name based on mode
export const generateAdultCardName = (mode: GameMode): string => {
  const useExtraSuggestive = Math.random() > 0.7;
  
  if (useExtraSuggestive) {
    const extremeNames = mode === 'naughty' ? suggestiveNames : dominationNames;
    return extremeNames[Math.floor(Math.random() * extremeNames.length)];
  }
  
  const prefixes = mode === 'naughty' ? naughtyPrefixes : nastyPrefixes;
  const suffixes = mode === 'naughty' ? naughtySuffixes : nastySuffixes;
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return `${prefix} ${suffix}`;
};

// Special move names with adult themes
const naughtySpecialMoves = [
  "Sweet Release",
  "Multiple Climax",
  "Deep Pleasure",
  "Soft Entry",
  "Sensual Touch",
  "Gentle Domination",
  "Furry Handcuffs",
  "Intimate Connection",
  "Stuffing Explosion",
  "Full Body Massage",
  "Erotic Whisper",
  "Slippery When Wet",
  "Slow Tease",
  "The Full Service",
  "Cream Filling"
];

const nastySpecialMoves = [
  "Brutal Penetration",
  "Forced Submission",
  "Pain Train",
  "No Safe Word",
  "Breaking Point",
  "Stuffing Violation",
  "Complete Domination",
  "Rough Entry",
  "Merciless Pounding",
  "Total Control",
  "Chains and Whips",
  "Tear It Open",
  "Primal Force",
  "Punishment Time",
  "Restrained and Helpless"
];

// Generate a special move name
export const generateSpecialMoveName = (mode: GameMode): string => {
  const moves = mode === 'naughty' ? naughtySpecialMoves : nastySpecialMoves;
  return moves[Math.floor(Math.random() * moves.length)];
};

// Description templates for naughty bears
const naughtyDescriptionTemplates = [
  "Soft to the touch but knows how to make you feel hard in all the right places.",
  "One stroke of {name}'s fur will have you begging for more intimate contact.",
  "Don't let the innocent eyes fool you - {name} knows exactly what you desire.",
  "Stuffed with passion and ready to release it all over you.",
  "Designed to find and stimulate all your sensitive spots.",
  "{name} gets wet with anticipation when you're around.",
  "The zipper isn't the only thing that comes down when {name} is in the mood.",
  "Plush in all the places you want to touch, and ready for you to squeeze.",
  "Will make you cry out in pleasure until the neighbors complain.",
  "Innocence on the outside, but {name} harbors the dirtiest thoughts about you."
];

// Description templates for nasty bears
const nastyDescriptionTemplates = [
  "Will tear into you without mercy until you're leaking stuffing everywhere.",
  "Specializes in inflicting the kind of pain that makes you beg for more.",
  "When {name} is done with you, sitting down will be a distant memory.",
  "Dominates with a brutal force that leaves marks for days.",
  "No safe word will save you from the punishment {name} has planned.",
  "Will leave you broken, bruised, and begging for another round.",
  "Those claws aren't just for show - they'll dig deep into your flesh.",
  "Restraint is not in {name}'s vocabulary - expect to be used thoroughly.",
  "The cute exterior hides a sadistic personality that loves to hear you scream.",
  "Will make you submit in ways you never thought possible."
];

// Generate an adult description for a card
export const generateAdultDescription = (name: string, mode: GameMode): string => {
  const templates = mode === 'naughty' ? naughtyDescriptionTemplates : nastyDescriptionTemplates;
  let template = templates[Math.floor(Math.random() * templates.length)];
  
  // Replace {name} placeholder with actual name
  return template.replace(/{name}/g, name);
};

// Generate punny names based on bear types
export const generatePunnyBearName = (): string => {
  const bearTypes = [
    "Teddy",
    "Grizzly",
    "Polar",
    "Panda",
    "Black",
    "Brown",
    "Honey",
    "Koala",
    "Stuffed",
    "Plush"
  ];
  
  const punnyNames = [
    "Bare",
    "Bearly Legal",
    "Beary Naughty",
    "Bearotica",
    "Un-bear-ably Sexy",
    "Bearback",
    "Bear Necessity",
    "Bearly Contained",
    "Bear Bottom",
    "Fur-bidden"
  ];
  
  const bearType = bearTypes[Math.floor(Math.random() * bearTypes.length)];
  const punnyName = punnyNames[Math.floor(Math.random() * punnyNames.length)];
  
  return `${bearType} ${punnyName}`;
};

// Generate reaction sounds for card effects
export const generateReactionSound = (mode: GameMode, intensity: number): string => {
  const lowNaughty = [
    "Mmm...",
    "Oh yes...",
    "That feels nice...",
    "Keep going...",
    "Don't stop..."
  ];
  
  const highNaughty = [
    "OH YES!",
    "RIGHT THERE!",
    "DON'T STOP!",
    "I'M COMING!",
    "HARDER!"
  ];
  
  const lowNasty = [
    "Ow...",
    "That hurts...",
    "More...",
    "Hurt me...",
    "Punish me..."
  ];
  
  const highNasty = [
    "DESTROY ME!",
    "BREAK ME!",
    "NO MERCY!",
    "MAKE IT HURT!",
    "PUNISH ME HARDER!"
  ];
  
  let sounds;
  if (mode === 'naughty') {
    sounds = intensity > 7 ? highNaughty : lowNaughty;
  } else {
    sounds = intensity > 7 ? highNasty : lowNasty;
  }
  
  return sounds[Math.floor(Math.random() * sounds.length)];
};
