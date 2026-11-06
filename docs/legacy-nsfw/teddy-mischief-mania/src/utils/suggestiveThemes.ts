
/**
 * Suggestive Themes - Contains voice lines, suggestive content, and terminology for the game
 * This module provides appropriate content for the adult-themed card battle game
 */

import { GameMode } from '@/lib/types/battleTypes';

// Content types for voice lines
export type ContentType = 
  'attack' | 'defend' | 'special' | 'victory' | 'defeat' | 
  'taunt' | 'compliment' | 'greeting' | 'tutorial' | 'cardPlay' |
  'seduction' | 'flirty' | 'aggressive' | 'dominant' | 'submissive';

// Voice line structure
interface VoiceLine {
  text: string;
  intensity: number; // 1-10, with 10 being most explicit
}

// Function to get a random voice line based on theme and content type
export function getRandomVoiceLine(theme: GameMode, contentType: ContentType, maxIntensity: number = 7): string {
  const availableLines = voiceLines[theme][contentType].filter(line => line.intensity <= maxIntensity);
  
  if (availableLines.length === 0) {
    return "Oh my... I don't know what to say!";
  }
  
  const randomIndex = Math.floor(Math.random() * availableLines.length);
  return availableLines[randomIndex].text;
}

// All voice lines organized by theme and content type
const voiceLines: Record<GameMode, Record<ContentType, VoiceLine[]>> = {
  naughty: {
    attack: [
      { text: "Let me show you what these paws can do...", intensity: 3 },
      { text: "I'm going to make you feel things you've never felt before.", intensity: 5 },
      { text: "My touch will leave you begging for more.", intensity: 6 },
      { text: "Ready for a night you won't forget?", intensity: 4 },
      { text: "I'm about to make you feel soooo good.", intensity: 5 }
    ],
    defend: [
      { text: "Not without a safe word, honey!", intensity: 4 },
      { text: "You'll have to try harder than that to get past my defenses.", intensity: 3 },
      { text: "I like it rough, but I'm still in control.", intensity: 5 },
      { text: "Your moves are cute, but I'm not impressed yet.", intensity: 4 },
      { text: "Mmm, is that all you've got?", intensity: 3 }
    ],
    special: [
      { text: "Let me show you my... special technique.", intensity: 5 },
      { text: "I've been saving this move just for you.", intensity: 4 },
      { text: "Get ready for my signature move!", intensity: 3 },
      { text: "You're about to experience pure ecstasy.", intensity: 6 },
      { text: "This is the move that makes all my playmates scream.", intensity: 7 }
    ],
    victory: [
      { text: "Was it good for you too?", intensity: 5 },
      { text: "That's how I like to finish.", intensity: 4 },
      { text: "Come back when you can handle me.", intensity: 4 },
      { text: "Mmm, that was satisfying.", intensity: 3 },
      { text: "Don't worry, everyone's first time is quick.", intensity: 6 }
    ],
    defeat: [
      { text: "You really know how to handle a teddy...", intensity: 4 },
      { text: "I'm spent... you've worn me out completely.", intensity: 5 },
      { text: "That was... intense. I need a cigarette.", intensity: 6 },
      { text: "You've shown me moves I didn't even know existed.", intensity: 4 },
      { text: "I surrender to your superior... technique.", intensity: 5 }
    ],
    taunt: [
      { text: "Is that all you've got in your toybox?", intensity: 3 },
      { text: "I've had better from a wind-up toy.", intensity: 4 },
      { text: "Your moves are leaving me... unsatisfied.", intensity: 5 },
      { text: "You call that a move? I barely felt it.", intensity: 4 },
      { text: "I've been with teddy bears twice your size.", intensity: 6 }
    ],
    compliment: [
      { text: "Ooh, you know just where to touch...", intensity: 5 },
      { text: "I love the way you handle your... cards.", intensity: 4 },
      { text: "You've got skills that make my stuffing tingle.", intensity: 6 },
      { text: "Your technique is... impressive.", intensity: 3 },
      { text: "You're making me feel things I've never felt before.", intensity: 5 }
    ],
    greeting: [
      { text: "Hey there, ready to play with me?", intensity: 3 },
      { text: "I've been waiting for someone like you to come along.", intensity: 2 },
      { text: "Let's get cozy and see where the night takes us.", intensity: 4 },
      { text: "I hope you're ready for some fun between the sheets... of cards.", intensity: 5 },
      { text: "Welcome to my playpen, I promise to be gentle... at first.", intensity: 4 }
    ],
    tutorial: [
      { text: "First time? Don't worry, I'll be gentle.", intensity: 4 },
      { text: "Let me show you how to handle your cards just right.", intensity: 3 },
      { text: "It's all about finding the right rhythm.", intensity: 4 },
      { text: "Watch and learn as I demonstrate the proper technique.", intensity: 3 },
      { text: "The secret is knowing when to hold them and when to... release.", intensity: 5 }
    ],
    cardPlay: [
      { text: "Watch me slide this one right in.", intensity: 5 },
      { text: "This card is going to hit all the right spots.", intensity: 4 },
      { text: "I'm putting this down nice and slow.", intensity: 3 },
      { text: "Feel the power as I lay this down.", intensity: 2 },
      { text: "This one's going to make you squirm.", intensity: 4 }
    ],
    seduction: [
      { text: "Let me whisper sweet nothings while I dominate you.", intensity: 5 },
      { text: "One touch from me and you'll be putty in my paws.", intensity: 4 },
      { text: "I know exactly what you want... and how to give it to you.", intensity: 6 },
      { text: "My honeypot is waiting just for you.", intensity: 7 },
      { text: "Let's skip the game and go straight to the after-party.", intensity: 5 }
    ],
    flirty: [
      { text: "Is that a card in your hand or are you just happy to see me?", intensity: 5 },
      { text: "Your moves are making my stuffing warm.", intensity: 4 },
      { text: "I bet you say that to all the teddies.", intensity: 3 },
      { text: "Keep looking at me like that and we might need to take a break.", intensity: 5 },
      { text: "I love the way you... shuffle your deck.", intensity: 4 }
    ],
    aggressive: [
      { text: "I'm going to make you beg for mercy... in a good way.", intensity: 6 },
      { text: "Ready for me to take control?", intensity: 4 },
      { text: "I'm not as soft as I look.", intensity: 3 },
      { text: "Time to show you who's the boss in this playpen.", intensity: 5 },
      { text: "You're about to get the stuffing knocked out of you.", intensity: 4 }
    ],
    dominant: [
      { text: "On your knees, my fluffy little plaything.", intensity: 6 },
      { text: "You'll do exactly as I say if you want to feel good.", intensity: 5 },
      { text: "I'm in charge now, and you're going to love every minute of it.", intensity: 5 },
      { text: "Call me 'master' from now on.", intensity: 7 },
      { text: "Your teddy belongs to me now.", intensity: 4 }
    ],
    submissive: [
      { text: "I'll be your good little bear...", intensity: 5 },
      { text: "Please, show me who's boss.", intensity: 4 },
      { text: "I'll do anything you want... anything.", intensity: 6 },
      { text: "Use me however you want.", intensity: 7 },
      { text: "I exist to please you.", intensity: 5 }
    ]
  },
  nasty: {
    attack: [
      { text: "I'm going to tear you limb from limb!", intensity: 3 },
      { text: "Your stuffing is about to be all over the floor.", intensity: 4 },
      { text: "This is going to hurt you more than it hurts me.", intensity: 3 },
      { text: "My claws are out and ready to shred!", intensity: 4 },
      { text: "Your fabric is about to get ripped!", intensity: 5 }
    ],
    defend: [
      { text: "Your pathetic attack bounces right off me!", intensity: 3 },
      { text: "I'm made of tougher stuff than you think.", intensity: 2 },
      { text: "You call that an attack? I've been hit harder by a pillow!", intensity: 4 },
      { text: "Your claws need sharpening if you want to hurt me.", intensity: 3 },
      { text: "Is that the best you can do? Pathetic!", intensity: 4 }
    ],
    special: [
      { text: "Prepare for total destruction!", intensity: 3 },
      { text: "I call this one 'The Stuffing Remover'!", intensity: 4 },
      { text: "You're about to experience a world of pain!", intensity: 4 },
      { text: "This move has ended many teddies before you!", intensity: 3 },
      { text: "Say goodbye to your limbs!", intensity: 5 }
    ],
    victory: [
      { text: "Look at you, all unstuffed and defeated.", intensity: 4 },
      { text: "Another trophy for my collection of defeated bears.", intensity: 3 },
      { text: "That was too easy. I barely broke a stitch.", intensity: 2 },
      { text: "Stay down if you know what's good for you.", intensity: 4 },
      { text: "Victory tastes sweet... like your tears.", intensity: 5 }
    ],
    defeat: [
      { text: "Impossible! I... I've been bested!", intensity: 2 },
      { text: "I'll get my revenge, mark my words!", intensity: 3 },
      { text: "This isn't over... I'll be back stronger!", intensity: 2 },
      { text: "You've won the battle, but not the war!", intensity: 3 },
      { text: "How dare you humiliate me like this!", intensity: 4 }
    ],
    taunt: [
      { text: "You fight like a plushie with no stuffing!", intensity: 3 },
      { text: "My grandmother hits harder than you!", intensity: 3 },
      { text: "Did you learn to fight from a sock puppet?", intensity: 2 },
      { text: "I've seen scarier attacks from a teddy tea party!", intensity: 3 },
      { text: "You're a disgrace to all battle teddies!", intensity: 4 }
    ],
    compliment: [
      { text: "That actually hurt... impressive.", intensity: 2 },
      { text: "You've got some fight in you after all.", intensity: 2 },
      { text: "That was a well-executed move, I'll give you that.", intensity: 1 },
      { text: "You're tougher than you look.", intensity: 2 },
      { text: "Now THAT'S how you throw a punch!", intensity: 3 }
    ],
    greeting: [
      { text: "Fresh meat for the grinder, I see.", intensity: 3 },
      { text: "Another victim enters my arena!", intensity: 2 },
      { text: "Look what the cat dragged in - fresh stuffing to tear out!", intensity: 4 },
      { text: "I hope you're ready to lose some limbs today.", intensity: 3 },
      { text: "Welcome to your doom, fluffball!", intensity: 3 }
    ],
    tutorial: [
      { text: "Lesson one: Pain. Lots of pain.", intensity: 3 },
      { text: "Let me show you how real teddies fight!", intensity: 2 },
      { text: "Watch closely as I demonstrate how to properly maim an opponent.", intensity: 4 },
      { text: "This isn't cuddle time, this is war! Let me show you how it's done.", intensity: 3 },
      { text: "First, you rip. Then, you tear. Questions?", intensity: 4 }
    ],
    cardPlay: [
      { text: "This card is going to destroy you!", intensity: 3 },
      { text: "Feel the power of my destruction!", intensity: 2 },
      { text: "This move will leave scars!", intensity: 3 },
      { text: "Prepare for pain!", intensity: 2 },
      { text: "This card has your name written all over it... in blood!", intensity: 4 }
    ],
    seduction: [
      { text: "I'll tear you apart... but you might enjoy it.", intensity: 5 },
      { text: "Pain and pleasure are two sides of the same coin.", intensity: 4 },
      { text: "I'll make you beg... for mercy.", intensity: 4 },
      { text: "My brutality can be quite... stimulating.", intensity: 5 },
      { text: "I can hurt you in ways you'll enjoy.", intensity: 6 }
    ],
    flirty: [
      { text: "You look cute when you're terrified.", intensity: 4 },
      { text: "Maybe I'll keep you around after I win.", intensity: 3 },
      { text: "You're pretty tough... I like that in a victim.", intensity: 3 },
      { text: "Fear looks good on you.", intensity: 4 },
      { text: "If you survive this, maybe we can get a drink after.", intensity: 3 }
    ],
    aggressive: [
      { text: "I'm going to enjoy tearing you limb from limb!", intensity: 4 },
      { text: "You've awakened the beast within me!", intensity: 3 },
      { text: "I'll show you the meaning of pain!", intensity: 3 },
      { text: "Your stuffing will decorate my victory room!", intensity: 4 },
      { text: "Time to get nasty!", intensity: 3 }
    ],
    dominant: [
      { text: "Bow before your master!", intensity: 4 },
      { text: "You exist only to be defeated by me!", intensity: 3 },
      { text: "I own this battlefield, and soon I'll own you!", intensity: 4 },
      { text: "Know your place, weakling!", intensity: 3 },
      { text: "Submit to my superior power!", intensity: 4 }
    ],
    submissive: [
      { text: "Please... not the face!", intensity: 3 },
      { text: "I'll do anything, just don't rip my arms off!", intensity: 4 },
      { text: "You're too powerful for me to resist!", intensity: 3 },
      { text: "I surrender to your might!", intensity: 2 },
      { text: "Have mercy on me, I beg you!", intensity: 3 }
    ]
  },
  neutral: {
    attack: [
      { text: "Preparing to attack!", intensity: 1 },
      { text: "Here comes my move!", intensity: 1 },
      { text: "Take this!", intensity: 1 },
      { text: "Attacking now!", intensity: 1 },
      { text: "Feel my power!", intensity: 2 }
    ],
    defend: [
      { text: "Blocking your attack!", intensity: 1 },
      { text: "Nice try!", intensity: 1 },
      { text: "Defense activated!", intensity: 1 },
      { text: "Not today!", intensity: 1 },
      { text: "Your attack fails!", intensity: 1 }
    ],
    special: [
      { text: "Special move activated!", intensity: 2 },
      { text: "Prepare for my special technique!", intensity: 1 },
      { text: "Unleashing my power!", intensity: 2 },
      { text: "Special attack incoming!", intensity: 1 },
      { text: "Witness my ultimate move!", intensity: 2 }
    ],
    victory: [
      { text: "Victory is mine!", intensity: 1 },
      { text: "I have prevailed!", intensity: 1 },
      { text: "Better luck next time!", intensity: 1 },
      { text: "That's game!", intensity: 1 },
      { text: "Another win for me!", intensity: 1 }
    ],
    defeat: [
      { text: "I've been defeated!", intensity: 1 },
      { text: "You win this round!", intensity: 1 },
      { text: "Good game!", intensity: 1 },
      { text: "Well played!", intensity: 1 },
      { text: "I'll get you next time!", intensity: 1 }
    ],
    taunt: [
      { text: "Is that all you've got?", intensity: 2 },
      { text: "You'll need to try harder than that!", intensity: 1 },
      { text: "That barely affected me!", intensity: 1 },
      { text: "You call that an attack?", intensity: 2 },
      { text: "I'm not impressed!", intensity: 1 }
    ],
    compliment: [
      { text: "Nice move!", intensity: 1 },
      { text: "Well played!", intensity: 1 },
      { text: "Impressive technique!", intensity: 1 },
      { text: "You're pretty good!", intensity: 1 },
      { text: "That was a great play!", intensity: 1 }
    ],
    greeting: [
      { text: "Let's have a good match!", intensity: 1 },
      { text: "Ready to play?", intensity: 1 },
      { text: "Welcome to the game!", intensity: 1 },
      { text: "May the best teddy win!", intensity: 1 },
      { text: "Let's begin!", intensity: 1 }
    ],
    tutorial: [
      { text: "Let me show you how the game works.", intensity: 1 },
      { text: "Here's what you need to know!", intensity: 1 },
      { text: "The rules are simple...", intensity: 1 },
      { text: "Let's go through the basics.", intensity: 1 },
      { text: "Pay attention to this tutorial!", intensity: 1 }
    ],
    cardPlay: [
      { text: "Playing this card!", intensity: 1 },
      { text: "I choose this one!", intensity: 1 },
      { text: "This card should do the trick!", intensity: 1 },
      { text: "Watch as I play this card!", intensity: 1 },
      { text: "Here's my move!", intensity: 1 }
    ],
    seduction: [
      { text: "Let's work together!", intensity: 1 },
      { text: "We could make a good team!", intensity: 1 },
      { text: "I sense a connection between us!", intensity: 2 },
      { text: "You're an interesting opponent!", intensity: 1 },
      { text: "I admire your strategy!", intensity: 1 }
    ],
    flirty: [
      { text: "You're pretty good at this game!", intensity: 1 },
      { text: "I like your style!", intensity: 1 },
      { text: "We should play again sometime!", intensity: 1 },
      { text: "You're making this interesting!", intensity: 1 },
      { text: "I'm enjoying our match!", intensity: 1 }
    ],
    aggressive: [
      { text: "I'm going to win this!", intensity: 1 },
      { text: "Prepare to lose!", intensity: 2 },
      { text: "You're no match for me!", intensity: 2 },
      { text: "Victory will be mine!", intensity: 1 },
      { text: "I won't hold back!", intensity: 1 }
    ],
    dominant: [
      { text: "I'm in control of this game!", intensity: 2 },
      { text: "Watch how a pro does it!", intensity: 1 },
      { text: "You're playing right into my strategy!", intensity: 1 },
      { text: "This game is mine!", intensity: 1 },
      { text: "I'm the master of this game!", intensity: 2 }
    ],
    submissive: [
      { text: "You're really good at this!", intensity: 1 },
      { text: "I'm learning from watching you play!", intensity: 1 },
      { text: "You've got me on the defensive!", intensity: 1 },
      { text: "I need to up my game!", intensity: 1 },
      { text: "You're making this challenging for me!", intensity: 1 }
    ]
  }
};

export default getRandomVoiceLine;
