
// Enhanced prompt generator for more creative NSFW teddy bear generation
// This uses more advanced techniques to generate prompts that better match the adult-themed game's style

export interface TeddyCardData {
  name: string;
  attack: number;
  defense: number;
  fluff: number;
  rarity: string;
  specialMove?: string;
  description?: string;
  type?: string;
  mode?: 'naughty' | 'nasty';
}

export class PromptGenerator {
  private static readonly baseStyle = "high quality detailed digital art, mischievous teddy bear, anthropomorphic, plush animal";
  
  private static readonly naughtyAdjectives = [
    "seductive", "flirtatious", "suggestive", "teasing", "alluring", 
    "sensual", "provocative", "coy", "sultry", "playful", "enticing",
    "tempting", "inviting", "charming", "attractive", "beguiling",
    "amorous", "romantic", "tantalizing", "suggestive"
  ];
  
  private static readonly nastyAdjectives = [
    "menacing", "aggressive", "fierce", "intimidating", "brutal", 
    "vicious", "savage", "threatening", "imposing", "fearsome", "ruthless",
    "ferocious", "intense", "dominating", "terrifying", "dangerous",
    "violent", "formidable", "powerful", "merciless", "hostile"
  ];
  
  private static readonly teddyFeatures = [
    "soft fur", "stitched seams", "button eyes", "plush texture", 
    "stuffed bear", "fabric paws", "cute nose", "rounded ears",
    "fuzzy body", "sewn limbs", "embroidered details", "patchwork",
    "felt material", "cuddly frame", "stuffing visible"
  ];
  
  private static readonly naughtyAccessories = [
    "silky bow tie", "heart-shaped patch", "rose in mouth", 
    "pink satin ribbons", "feather boa", "lace details", 
    "valentine hearts", "champagne glass", "silk robe",
    "satin bedsheet", "honey pot", "bedside candles",
    "fuzzy handcuffs", "love letter", "perfume bottle",
    "chocolate box", "velvet cushion", "flirty bow"
  ];
  
  private static readonly nastyAccessories = [
    "spiked collar", "torn fabric", "battle scars", "eye patch", 
    "ripped seams", "metal studs", "chains", "leather straps", 
    "exposed stuffing", "small weapons", "bandages",
    "battle axe", "spiked bat", "torn ear", "missing eye",
    "blood-stained fur", "warhammer", "brass knuckles",
    "torn clothing", "battle helmet", "war paint"
  ];
  
  /**
   * Generate a creative prompt for a teddy bear based on card attributes
   */
  public static generatePrompt(cardData: TeddyCardData): string {
    const { name, attack, defense, fluff, rarity, specialMove, description, type, mode } = cardData;
    
    // Determine if card is more naughty or nasty based on various factors
    let isNaughty: boolean;
    
    if (mode) {
      isNaughty = mode === 'naughty';
    } else {
      isNaughty = fluff > attack || 
                  (name.toLowerCase().includes("love") || 
                   name.toLowerCase().includes("heart") || 
                   name.toLowerCase().includes("cuddle") ||
                   name.toLowerCase().includes("seduc") ||
                   name.toLowerCase().includes("flirt") ||
                   (specialMove?.toLowerCase().includes("seduc") ?? false));
    }
    
    // Select appropriate adjectives and accessories based on mode
    const modeAdjectives = isNaughty ? this.naughtyAdjectives : this.nastyAdjectives;
    const modeAccessories = isNaughty ? this.naughtyAccessories : this.nastyAccessories;
    
    // Pick random items from each category
    const selectedAdjectives = this.getRandomItems(modeAdjectives, 3).join(", ");
    const selectedFeatures = this.getRandomItems(this.teddyFeatures, 3).join(", ");
    const selectedAccessories = this.getRandomItems(modeAccessories, 2).join(", ");
    
    // Build expressions and poses based on card type
    let expression, pose;
    
    if (isNaughty) {
      const naughtyExpressions = [
        "winking", "smiling seductively", "playful grin", "flirtatious smile", 
        "bedroom eyes", "coy smile", "suggestive gaze", "cheeky grin",
        "fluttering eyelashes", "sultry expression", "come-hither look",
        "blushing cheeks", "mischievous smile"
      ];
      
      const naughtyPoses = [
        "striking a flirtatious pose", "lounging suggestively", 
        "blowing a kiss", "leaning forward invitingly", 
        "showing off curves", "dancing playfully",
        "sprawled seductively", "laying on side", "batting eyelashes",
        "stretching sensually", "posing with a flower", "hugging a heart pillow",
        "with one paw behind head", "with hip thrust forward"
      ];
      
      expression = this.getRandomItems(naughtyExpressions, 1)[0];
      pose = this.getRandomItems(naughtyPoses, 1)[0];
    } else {
      const nastyExpressions = [
        "scowling", "menacing grin", "snarling", "evil smile", "fierce glare",
        "wild eyes", "angry scowl", "battle cry", "bared teeth",
        "intimidating stare", "battle rage", "murderous glare",
        "wicked grin", "predatory look"
      ];
      
      const nastyPoses = [
        "in fighting stance", "flexing muscles", 
        "brandishing claws", "mid-attack pose", 
        "dominating pose", "showing strength",
        "preparing to pounce", "raising weapon", "lunging forward",
        "with fists clenched", "with back arched", "ready to attack",
        "showing off battle wounds", "stomping foot", "swinging weapon"
      ];
      
      expression = this.getRandomItems(nastyExpressions, 1)[0];
      pose = this.getRandomItems(nastyPoses, 1)[0];
    }
    
    // Adjust background based on rarity and mode
    let background;
    if (isNaughty) {
      switch (rarity) {
        case "Common":
          background = "simple pink bedroom background";
          break;
        case "Uncommon":
          background = "romantic pink and purple gradient background with hearts";
          break;
        case "Rare":
          background = "luxurious boudoir with soft lighting and silk sheets";
          break;
        case "Epic":
        case "Legendary":
          background = "fantasy passionate setting with magical elements and glowing effects";
          break;
        default:
          background = "romantic gradient background";
      }
    } else {
      switch (rarity) {
        case "Common":
          background = "simple fighting arena background";
          break;
        case "Uncommon":
          background = "intense battlefield with smoke and debris";
          break;
        case "Rare":
          background = "dramatic battlefield with fire and destruction";
          break;
        case "Epic":
        case "Legendary":
          background = "epic combat arena with lightning and dramatic lighting";
          break;
        default:
          background = "battle arena background";
      }
    }
    
    // Special move integration
    const specialMovePhrase = specialMove 
      ? `performing their special move "${specialMove}", ` 
      : "";
    
    // Name integration (avoid putting the actual name in to prevent text in image)
    const nameAttributes = this.extractNameAttributes(name);
    const nameConcept = nameAttributes ? `with ${nameAttributes} attributes, ` : "";
    
    // Stats influence
    const statInfluence = this.getStatInfluence(attack, defense, fluff);
    
    // Build the final prompt
    const prompt = `
      ${this.baseStyle}, a ${selectedAdjectives} anthropomorphic teddy bear with ${selectedFeatures},
      wearing ${selectedAccessories}, ${expression}, ${pose}, ${nameConcept}
      ${specialMovePhrase}${statInfluence} against a ${background}.
      The bear is ${isNaughty ? 'in Naughty Mode, using seduction tactics' : 'in Nasty Mode, using brutal force'}.
      Rarity: ${rarity}. No text, no words, no labels in the image.
    `.trim().replace(/\s+/g, ' ');
    
    return prompt;
  }
  
  /**
   * Get random items from an array
   */
  private static getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  /**
   * Extract relevant attributes from card name
   */
  private static extractNameAttributes(name: string): string | null {
    // Extract meaningful attributes from the name, avoiding literal name insertion
    const lowercaseName = name.toLowerCase();
    const attributes = [];
    
    // Check for color terms
    const colors = ['red', 'blue', 'green', 'purple', 'pink', 'gold', 'silver', 'black', 'white'];
    for (const color of colors) {
      if (lowercaseName.includes(color)) {
        attributes.push(`${color}-colored`);
      }
    }
    
    // Check for material terms
    const materials = ['silk', 'satin', 'velvet', 'leather', 'metal', 'golden', 'silver', 'diamond'];
    for (const material of materials) {
      if (lowercaseName.includes(material)) {
        attributes.push(material);
      }
    }
    
    // Check for character terms
    const characters = [
      'king', 'queen', 'prince', 'princess', 'knight', 'warrior', 'ninja', 'samurai',
      'wizard', 'witch', 'mage', 'rogue', 'thief', 'assassin', 'hunter', 'vampire',
      'demon', 'angel', 'fairy', 'elf', 'dwarf', 'orc', 'troll', 'goblin'
    ];
    for (const character of characters) {
      if (lowercaseName.includes(character)) {
        attributes.push(character);
      }
    }
    
    // Check for descriptive terms
    const descriptions = [
      'big', 'small', 'tiny', 'giant', 'huge', 'massive', 'miniature',
      'ancient', 'old', 'young', 'baby', 'elder', 'wise', 'smart', 'clever',
      'strong', 'weak', 'powerful', 'mighty', 'brave', 'fearless', 'timid',
      'shy', 'loud', 'quiet', 'silent', 'noisy', 'sleepy', 'alert', 'awake',
      'happy', 'sad', 'angry', 'furious', 'enraged', 'calm', 'peaceful',
      'wild', 'tame', 'feral', 'domestic', 'exotic', 'rare', 'common',
      'magical', 'enchanted', 'cursed', 'blessed', 'holy', 'unholy', 'sacred',
      'dark', 'light', 'bright', 'dim', 'shiny', 'dull', 'glossy', 'matte'
    ];
    for (const desc of descriptions) {
      if (lowercaseName.includes(desc)) {
        attributes.push(desc);
      }
    }
    
    return attributes.length > 0 ? attributes.join(', ') : null;
  }
  
  /**
   * Generate description of the bear based on stats
   */
  private static getStatInfluence(attack: number, defense: number, fluff: number): string {
    const statDescriptions = [];
    
    if (attack > 7) {
      statDescriptions.push("extremely powerful");
    } else if (attack > 5) {
      statDescriptions.push("very strong");
    } else if (attack < 3) {
      statDescriptions.push("physically weak");
    }
    
    if (defense > 7) {
      statDescriptions.push("heavily armored");
    } else if (defense > 5) {
      statDescriptions.push("well-protected");
    } else if (defense < 3) {
      statDescriptions.push("vulnerable-looking");
    }
    
    if (fluff > 7) {
      statDescriptions.push("incredibly fluffy and charming");
    } else if (fluff > 5) {
      statDescriptions.push("quite adorable");
    } else if (fluff < 3) {
      statDescriptions.push("intimidating");
    }
    
    if (statDescriptions.length === 0) {
      return "with balanced attributes";
    }
    
    return statDescriptions.join(", ");
  }
}

// Export the main function for generating prompts
export const generateEnhancedTeddyPrompt = (cardData: TeddyCardData): string => {
  return PromptGenerator.generatePrompt(cardData);
};
