
// This function generates prompts for creating teddy bear images based on card data
export const generateTeddyPrompt = async (cardData: any): Promise<string> => {
  const { name, attack, defense, fluff, rarity, specialMove, description } = cardData;
  
  // Base styles that will be included in all prompts
  const baseStyle = "high quality, detailed digital art, cartoon style, anthropomorphic teddy bear";
  
  // Mode-specific adjectives
  const naughtyAdjectives = [
    "seductive", "flirtatious", "suggestive", "teasing", "alluring", 
    "sensual", "provocative", "playful", "enticing", "coy", "sultry"
  ];
  
  const nastyAdjectives = [
    "menacing", "aggressive", "fierce", "intimidating", "brutal", 
    "vicious", "savage", "threatening", "imposing", "fearsome", "ruthless"
  ];
  
  // Teddy bear features
  const teddyFeatures = [
    "soft fur", "stitched seams", "button eyes", "plush texture", 
    "stuffed bear", "fabric paws", "cute nose", "rounded ears"
  ];
  
  // Adult-themed accessories based on card type
  const naughtyAccessories = [
    "silky bow tie", "heart-shaped patch", "rose in mouth", 
    "pink satin ribbons", "feather boa", "lace details", 
    "valentine hearts", "champagne glass", "silk robe"
  ];
  
  const nastyAccessories = [
    "spiked collar", "torn fabric", "battle scars", "eye patch", 
    "ripped seams", "metal studs", "chains", "leather straps", 
    "exposed stuffing", "small weapons", "bandages"
  ];
  
  // Determine if card is more naughty or nasty based on stats
  const isNaughty = fluff > attack || name.toLowerCase().includes("love") || 
                  name.toLowerCase().includes("heart") || name.toLowerCase().includes("cuddle");
  
  // Select appropriate adjectives and accessories
  const modeAdjectives = isNaughty ? naughtyAdjectives : nastyAdjectives;
  const modeAccessories = isNaughty ? naughtyAccessories : nastyAccessories;
  
  // Pick random items from each category
  const getRandomItems = (array: string[], count: number) => {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };
  
  const selectedAdjectives = getRandomItems(modeAdjectives, 2).join(", ");
  const selectedFeatures = getRandomItems(teddyFeatures, 3).join(", ");
  const selectedAccessories = getRandomItems(modeAccessories, 2).join(", ");
  
  // Build expressions and poses based on card type
  let expression, pose;
  
  if (isNaughty) {
    const naughtyExpressions = ["winking", "smiling seductively", "playful grin", "flirtatious smile", "bedroom eyes"];
    const naughtyPoses = [
      "striking a flirtatious pose", "lounging suggestively", 
      "blowing a kiss", "leaning forward invitingly", 
      "showing off curves", "dancing playfully"
    ];
    expression = getRandomItems(naughtyExpressions, 1)[0];
    pose = getRandomItems(naughtyPoses, 1)[0];
  } else {
    const nastyExpressions = ["scowling", "menacing grin", "snarling", "evil smile", "fierce glare"];
    const nastyPoses = [
      "in fighting stance", "flexing muscles", 
      "brandishing claws", "mid-attack pose", 
      "dominating pose", "showing strength"
    ];
    expression = getRandomItems(nastyExpressions, 1)[0];
    pose = getRandomItems(nastyPoses, 1)[0];
  }
  
  // Adjust background based on rarity
  let background;
  switch (rarity) {
    case "Common":
      background = isNaughty 
        ? "simple pink bedroom background" 
        : "simple fighting arena background";
      break;
    case "Uncommon":
      background = isNaughty 
        ? "romantic pink and purple gradient background with hearts" 
        : "intense battlefield with smoke and debris";
      break;
    case "Rare":
      background = isNaughty 
        ? "luxurious boudoir with soft lighting and silk sheets" 
        : "dramatic battlefield with fire and destruction";
      break;
    case "Epic":
    case "Legendary":
      background = isNaughty 
        ? "fantasy passionate setting with magical elements and glowing effects" 
        : "epic combat arena with lightning and dramatic lighting";
      break;
    default:
      background = "simple gradient background";
  }
  
  // Special move integration
  const specialMovePhrase = specialMove 
    ? `performing their special move "${specialMove}", ` 
    : "";
  
  // Name integration (avoid putting the actual name in to prevent text in image)
  const nameConcept = name ? `embodying the essence of ${name.split(' ')[0]}, ` : "";
  
  // Build the final prompt
  const prompt = `
    ${baseStyle}, a ${selectedAdjectives} anthropomorphic teddy bear with ${selectedFeatures},
    wearing ${selectedAccessories}, ${expression}, ${pose}, ${nameConcept}
    ${specialMovePhrase}against a ${background}. 
    The bear has an attack power of ${attack}, defense of ${defense}, and fluff factor of ${fluff}.
    No text, no words, no labels in the image.
  `.trim().replace(/\s+/g, ' ');
  
  return prompt;
};
