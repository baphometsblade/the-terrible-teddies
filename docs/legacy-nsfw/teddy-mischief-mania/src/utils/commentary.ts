
import { GameMode, BattleAction } from "@/lib/types/battleTypes";

// Collection of commentary snippets by type and mode
const commentaryDatabase = {
  naughty: {
    attack: [
      "That's a flirty little move!",
      "Getting handsy, aren't we?",
      "Such a tease!",
      "Ooh, that's forward...",
      "Quite the intimate gesture!"
    ],
    defend: [
      "Playing hard to get, I see.",
      "Not so fast, cutie!",
      "Resisting those charms!",
      "Teasing with a little defense.",
      "Holding back for the big moment."
    ],
    "card-played": [
      "Look who just joined the fun!",
      "A new flirt enters the scene!",
      "Ooh, fresh eye candy!",
      "Here comes trouble... the good kind!",
      "Well hello there, gorgeous!"
    ],
    "turn-change": [
      "Your move, hot stuff.",
      "Show me what you've got now.",
      "Let's see your best moves.",
      "The ball's in your court, sexy.",
      "Time to reciprocate?"
    ],
    "special-move": [
      "Oh my, that's VERY special!",
      "Getting spicy now!",
      "That's one way to make an impression!",
      "Talk about leaving them breathless!",
      "Now THAT'S how you seduce someone!"
    ],
    "safe-word": [
      "Taking a little breather... too intense?",
      "Let's slow things down a bit.",
      "Time for a cool-down period.",
      "Dialing back the intensity.",
      "Taking it down a notch."
    ],
    "mode-switch": [
      "Switching to your naughty side, I see!",
      "Getting in the mood for seduction!",
      "Time for some charm and flirtation!",
      "Let's play a more suggestive game...",
      "The seduction begins!"
    ],
    "damage-dealt": [
      "That's going to leave an emotional mark!",
      "Heart status: fluttering!",
      "Someone's getting all flustered!",
      "Feelings are definitely getting hurt!",
      "Straight to the heart!"
    ],
    buff: [
      "Looking extra irresistible now!",
      "Someone's confidence just peaked!",
      "Talk about magnetic charm!",
      "Pheromones: activated!",
      "Attractiveness level: over 9000!"
    ],
    debuff: [
      "That's a mood killer!",
      "Someone's charm just took a hit!",
      "Awkward moment alert!",
      "Seduction attempt: failed!",
      "Not looking so hot now!"
    ],
    heal: [
      "Feeling rejuvenated and frisky!",
      "Getting that loving feeling back!",
      "Heart's racing again!",
      "Ready for round two!",
      "Confidence restored!"
    ],
    seduce: [
      "Those bedroom eyes are working!",
      "Is it getting hot in here?",
      "That wink was super effective!",
      "Someone's falling for your charms!",
      "Seduction level: expert!"
    ],
    dominate: [
      "Taking control of the situation!",
      "Someone likes being in charge!",
      "Showing who's boss in the bedroom!",
      "Asserting dominance, flirtatiously!",
      "Power play initiated!"
    ],
    tease: [
      "Just a little taste of what's to come!",
      "Playing hard to get, aren't we?",
      "The anticipation is killing them!",
      "Leaving them wanting more!",
      "Master class in teasing!"
    ],
    punish: [
      "Someone's been naughty!",
      "A playful spanking is in order!",
      "Teaching a flirty lesson!",
      "Time to discipline that teddy!",
      "Punished with pleasure!"
    ]
  },
  nasty: {
    attack: [
      "That's gonna leave a mark!",
      "Brutal takedown!",
      "Vicious attack!",
      "Right where it hurts!",
      "Savagely effective!"
    ],
    defend: [
      "Not today!",
      "Blocking that pathetic attempt!",
      "Defense holds strong!",
      "Try harder next time!",
      "Like hitting a brick wall!"
    ],
    "card-played": [
      "A new challenger enters the fray!",
      "Fresh meat for the grinder!",
      "Another combatant joins the battle!",
      "Look out, we've got a tough one here!",
      "Ready to rumble!"
    ],
    "turn-change": [
      "Your move, if you dare.",
      "Let's see what pitiful attack you've got.",
      "Step up or step out.",
      "Time to face your doom.",
      "Your turn to suffer."
    ],
    "special-move": [
      "Devastating special attack!",
      "That's going to require surgery!",
      "Brutality personified!",
      "Absolutely demolished!",
      "That's gotta hurt!"
    ],
    "safe-word": [
      "Calling a timeout from the beatdown.",
      "Taking a break from the carnage.",
      "Pausing the destruction momentarily.",
      "Brief respite from the pain.",
      "Mercy granted... temporarily."
    ],
    "mode-switch": [
      "Gloves are coming off now!",
      "Time for some real pain!",
      "Getting serious with the hurt!",
      "No more playing nice!",
      "Bringing the brutality!"
    ],
    "damage-dealt": [
      "Critical hit to the stuffing!",
      "Taking massive damage!",
      "That's gonna need stitches!",
      "Fur is flying everywhere!",
      "Direct hit!"
    ],
    buff: [
      "Power levels increasing!",
      "Muscles bulging with rage!",
      "Strength amplified!",
      "Looking more dangerous now!",
      "Combat effectiveness enhanced!"
    ],
    debuff: [
      "Weakening their defenses!",
      "Breaking their spirit!",
      "They're looking vulnerable now!",
      "That took the fight out of them!",
      "Almost ready to submit!"
    ],
    heal: [
      "Back in fighting form!",
      "Ready for more punishment!",
      "Second wind activated!",
      "Restored and ready to rumble!",
      "Pain tolerance recharged!"
    ],
    seduce: [
      "Intimidating presence!",
      "Fear is an aphrodisiac!",
      "Terrifying in an attractive way!",
      "Danger is sexy!",
      "Threatening yet somehow alluring!"
    ],
    dominate: [
      "Complete subjugation!",
      "Total control established!",
      "Asserting absolute dominance!",
      "They're completely at your mercy!",
      "Supremacy achieved!"
    ],
    tease: [
      "Psychological warfare!",
      "Mental torture at its finest!",
      "Breaking them down methodically!",
      "Toying with their fragile ego!",
      "Cruel mind games!"
    ],
    punish: [
      "Severe retribution!",
      "Justice served brutally!",
      "Teaching a painful lesson!",
      "No mercy for the weak!",
      "Punishment fits the crime!"
    ]
  },
  neutral: {
    attack: [
      "A solid attack!",
      "Direct hit!",
      "That connected well!",
      "Effective strike!",
      "Good move!"
    ],
    defend: [
      "Good defense!",
      "Blocked successfully!",
      "Protected against that one!",
      "Defense holds!",
      "Attack thwarted!"
    ],
    "card-played": [
      "New card in play!",
      "Fresh contender on the field!",
      "A new challenger appears!",
      "Card successfully played!",
      "New asset deployed!"
    ],
    "turn-change": [
      "Changing turns now.",
      "Your move.",
      "Turn completed, switching sides.",
      "Control passes to the other player.",
      "Turn ended, next player."
    ],
    "special-move": [
      "Special move activated!",
      "Using a special technique!",
      "Special ability triggered!",
      "Unleashing special attack!",
      "Special move successful!"
    ],
    "safe-word": [
      "Pause requested.",
      "Taking a strategic break.",
      "Game temporarily paused.",
      "Brief timeout called.",
      "Short intermission."
    ],
    "mode-switch": [
      "Tactical mode change.",
      "Switching strategies.",
      "Changing approach.",
      "New mode activated.",
      "Tactical shift initiated."
    ]
  }
};

// Get a random taunt based on the current game state
export const getTauntCommentary = (mode: GameMode = "naughty"): string => {
  const taunts = [
    "Ready to surrender yet?",
    "Is that all you've got?",
    "You call that a move?",
    "My teddy's just warming up!",
    "This is going to be easy...",
    "Feeling intimidated?",
    "You're way out of your league!",
    "My teddy's going to dominate yours!",
    "Prepare for total humiliation!",
    "Your teddy doesn't stand a chance!"
  ];
  
  return taunts[Math.floor(Math.random() * taunts.length)];
};

// Generate appropriate commentary based on the action
export const generateCommentary = (action: BattleAction, gameMode: GameMode = "naughty"): string => {
  try {
    // Use the action's game mode if provided, otherwise use the passed game mode
    const mode = action.gameMode || gameMode;
    
    // Get commentary database for this mode
    const modeDatabase = commentaryDatabase[mode] || commentaryDatabase.neutral;
    
    // Get commentary options for this action type
    const options = modeDatabase[action.type as keyof typeof modeDatabase] || commentaryDatabase.neutral[action.type as keyof typeof commentaryDatabase.neutral];
    
    // If we have specific options for this action type, pick a random one
    if (options && Array.isArray(options) && options.length > 0) {
      return options[Math.floor(Math.random() * options.length)];
    }
    
    // Fallback to a generic message or the action message
    return action.message || "The battle continues...";
  } catch (error) {
    console.error("Error generating commentary:", error);
    return action.message || "The battle continues...";
  }
};

// Get random comments for specific situations
export const getRandomCommentary = (situation: string, mode: GameMode = "naughty"): string => {
  const modeDatabase = commentaryDatabase[mode] || commentaryDatabase.neutral;
  const options = modeDatabase[situation as keyof typeof modeDatabase] || [];
  
  if (Array.isArray(options) && options.length > 0) {
    return options[Math.floor(Math.random() * options.length)];
  }
  
  return "The battle continues...";
};
