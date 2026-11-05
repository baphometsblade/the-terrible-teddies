import { Card, CardType, SecretTrigger, AbilityTrigger } from './types';

/**
 * NOTE FOR DEVELOPER:
 * This file contains the static card data for the game. The `imageUrl` properties now point to local assets.
 * The card data has been expanded based on the user's "80-Card Database" prompt, adapting new concepts
 * to the existing game engine's capabilities.
 */

export const PREGENERATED_CARD_DATA: Card[] = [
  // --- SECRET CARDS ---
  {
    "id": 201,
    "name": "Counterfeit Cuddle",
    "scandalCost": 2,
    "story": "That new arrival seems... familiar. And awfully cheap. Send it back from whence it came.",
    "imagePrompt": "A magnifying glass revealing shoddy stitching and a 'Made in a Hurry' tag on a teddy bear's arm.",
    "cardType": CardType.SECRET,
    "imageUrl": "/assets/images/secret_card_bg.png",
    "secretTrigger": SecretTrigger.OPPONENT_PLAYS_BEAR,
    "secretAbility": {
      "trigger": "ON_DEFEND",
      "type": "RETURN_TO_HAND",
      "target": "TRIGGERING_CARD",
      "description": "When your opponent plays a Bear, return it to their hand."
    }
  },
  {
    "id": 202,
    "name": "Sudden Betrayal",
    "scandalCost": 3,
    "story": "The attack was swift, but the knife in the back was swifter. A classic tale of ambition.",
    "imagePrompt": "An ornate dagger with a teddy bear pommel, plunged into a velvet cushion.",
    "cardType": CardType.SECRET,
    "imageUrl": "/assets/images/secret_card_bg.png",
    "secretTrigger": SecretTrigger.OWN_BEAR_ATTACKED,
    "secretAbility": {
      "trigger": "ON_DEFEND",
      "type": "DESTROY",
      "target": "TRIGGERING_CARD",
      "description": "When one of your Bears is attacked, destroy the attacking Bear before combat."
    }
  },
  {
    "id": 203,
    "name": "Embarrassing Photo",
    "scandalCost": 2,
    "story": "A picture is worth a thousand words. This one mostly says 'blackmail'.",
    "imagePrompt": "A blurry, compromising polaroid photo of a well-dressed teddy bear in a very undignified situation.",
    "cardType": CardType.SECRET,
    "imageUrl": "/assets/images/secret_card_bg.png",
    "secretTrigger": SecretTrigger.OPPONENT_ATTACKS_PLAYER,
    "secretAbility": {
      "trigger": "ON_DEFEND",
      "type": "DAMAGE",
      "target": "OPPONENT_PLAYER",
      "value": 3,
      "description": "When your opponent attacks you directly, deal 3 damage to them."
    }
  },

  // --- BEAR CARDS ---
  { "id": 1, "name": "Butler Bear", "scandalCost": 1, "cardType": CardType.BEAR, "attack": 2, "defense": 1, "story": "He's seen things. Unspeakable things. And he keeps the silverware polished.", "imagePrompt": "A stoic teddy bear in a butler's uniform, holding a silver tray." },
  { "id": 2, "name": "Pillow Biter", "scandalCost": 2, "cardType": CardType.BEAR, "attack": 2, "defense": 3, "story": "Don't let the name fool you. He's just very passionate about interior design.", "imagePrompt": "A fluffy teddy bear aggressively biting a silk pillow." },
  { "id": 3, "name": "Guard Cub", "scandalCost": 2, "cardType": CardType.BEAR, "attack": 1, "defense": 4, "keywords": ["GUARD"], "story": "He's small but sturdy. Mostly fluff, but with a heart of... more fluff.", "imagePrompt": "A small, serious-looking teddy bear in a guard's uniform standing in front of a door." },
  { "id": 4, "name": "Gossip-Monger", "scandalCost": 2, "cardType": CardType.BEAR, "attack": 2, "defense": 1, "ability": { "trigger": "ON_PLAY", "type": "DRAW", "target": "SELF_PLAYER", "value": 1, "description": "Draw a card." }, "story": "He knows everyone's dirty little secrets. For a price.", "imagePrompt": "A teddy bear whispering into another's ear, both looking mischievous." },
  { "id": 5, "name": "Debaucherous Duke", "scandalCost": 3, "cardType": CardType.BEAR, "attack": 3, "defense": 4, "story": "His parties are legendary. The cleanup, however, is a matter of state security.", "imagePrompt": "A regal teddy bear in a duke's attire, holding a glass of wine, looking dishevelled." },
  { "id": 6, "name": "Seductive Assassin", "scandalCost": 3, "cardType": CardType.BEAR, "attack": 4, "defense": 1, "keywords": ["STEALTH"], "story": "You'll never see her coming, but you'll definitely know she's been there.", "imagePrompt": "A sleek female teddy bear in a black catsuit, holding a dagger, hiding in shadows." },
  { "id": 7, "name": "Fluffy Bodyguard", "scandalCost": 4, "cardType": CardType.BEAR, "attack": 2, "defense": 7, "keywords": ["GUARD"], "story": "His only purpose is to absorb... punishment. He's very good at it.", "imagePrompt": "A massive, imposing teddy bear wearing a suit and sunglasses." },
  { "id": 8, "name": "Knight of the Boudoir", "scandalCost": 4, "cardType": CardType.BEAR, "attack": 5, "defense": 3, "keywords": ["SWIFT"], "story": "He's always ready for action. Always.", "imagePrompt": "A gallant teddy bear in shining armor riding a hobby horse." },
  { "id": 9, "name": "Vampiric Viscount", "scandalCost": 4, "cardType": CardType.BEAR, "attack": 3, "defense": 3, "keywords": ["LEECH"], "story": "He has a thirst that can't be quenched. And a penchant for velvet.", "imagePrompt": "A pale teddy bear with fangs, wearing a dramatic cape." },
  { "id": 10, "name": "Armored Baron", "scandalCost": 5, "cardType": CardType.BEAR, "attack": 4, "defense": 6, "armor": 1, "story": "He comes prepared for any... engagement.", "imagePrompt": "A large teddy bear wearing ornate, heavy plate armor." },
  { "id": 11, "name": "The Consort", "scandalCost": 5, "cardType": CardType.BEAR, "attack": 4, "defense": 4, "ability": { "trigger": "ON_PLAY", "type": "HEAL", "target": "SELF_PLAYER", "value": 4, "description": "Heal yourself for 4." }, "story": "Provides comfort and support. And a very generous allowance.", "imagePrompt": "A handsome, well-dressed teddy bear offering a comforting paw." },
  { "id": 12, "name": "War-Bear Veteran", "scandalCost": 6, "cardType": CardType.BEAR, "attack": 7, "defense": 5, "story": "He fought in the Great Fluff War. He's seen things you wouldn't believe.", "imagePrompt": "An old, grizzled teddy bear with an eyepatch and several stitched-up scars." },
  { "id": 13, "name": "Lord of Indulgence", "scandalCost": 7, "cardType": CardType.BEAR, "attack": 8, "defense": 8, "story": "His desires are as vast as his fortune.", "imagePrompt": "An obese, decadent teddy bear sitting on a throne made of pillows and gold.", "videoUrl": "/assets/videos/gold_particles.mp4" },
  {
    "id": 24, "name": "Whispering Wretch", "scandalCost": 3, "cardType": CardType.BEAR, "attack": 3, "defense": 2, "keywords": ["HAUNTING"],
    "story": "Even in disgrace, his whispers sow discord from the discard pile.",
    "imagePrompt": "A ghostly, translucent teddy bear, chains rattling, whispering into the ear of a shadowy figure.",
    "hauntingAbility": {
      "trigger": "FROM_GRAVEYARD",
      "type": "DAMAGE",
      "target": "OPPONENT_PLAYER",
      "value": 1,
      "cost": 2,
      "description": "From the Graveyard: Pay 2 Scandal to deal 1 damage to the opponent."
    }
  },
  
  // --- SCANDAL CARDS ---
  { "id": 101, "name": "A Stiff Drink", "scandalCost": 1, "cardType": CardType.SCANDAL, "ability": { "trigger": "ON_PLAY", "type": "DRAW", "target": "SELF_PLAYER", "value": 2, "description": "Draw 2 cards." }, "story": "Sometimes, one must fortify the spirit before the debauchery.", "imagePrompt": "A teddy bear's paw holding a crystal tumbler with amber liquid." },
  { "id": 102, "name": "A Pointed Remark", "scandalCost": 2, "cardType": CardType.SCANDAL, "ability": { "trigger": "ON_PLAY", "type": "TARGETED_DAMAGE", "target": "OPPONENT_CARD", "value": 3, "description": "Deal 3 damage to the opponent's Bear." }, "story": "Words can hurt more than swords. Especially when they're true.", "imagePrompt": "A quill pen dripping a single drop of poison." },
  { "id": 103, "name": "Hush Money", "scandalCost": 3, "cardType": CardType.SCANDAL, "ability": { "trigger": "ON_PLAY", "type": "DISCARD_RANDOM", "target": "OPPONENT_PLAYER", "value": 1, "description": "Your opponent discards a random card." }, "story": "Every bear has a price. It's usually not very high.", "imagePrompt": "A suitcase overflowing with button-coins." },
  { "id": 104, "name": "An Illicit Affair", "scandalCost": 4, "cardType": CardType.SCANDAL, "ability": { "trigger": "ON_PLAY", "type": "DAMAGE", "target": "OPPONENT_PLAYER", "value": 5, "description": "Deal 5 damage to your opponent." }, "story": "Thrilling, dangerous, and utterly worth it.", "imagePrompt": "Two shadowy teddy bear figures embracing in a moonlit garden." },
  { "id": 105, "name": "Restorative Nap", "scandalCost": 2, "cardType": CardType.SCANDAL, "ability": { "trigger": "ON_PLAY", "type": "HEAL", "target": "SELF_PLAYER", "value": 3, "description": "Heal yourself for 3." }, "story": "One must be well-rested for a night of scandal.", "imagePrompt": "A teddy bear sleeping peacefully in a luxurious four-poster bed." },
  { "id": 106, "name": "Total Annihilation", "scandalCost": 6, "cardType": CardType.SCANDAL, "ability": { "trigger": "ON_PLAY", "type": "DESTROY", "target": "OPPONENT_CARD", "description": "Destroy the opponent's Bear." }, "story": "Some situations require a... permanent solution.", "imagePrompt": "A massive explosion in a teddy bear mansion." }
];
