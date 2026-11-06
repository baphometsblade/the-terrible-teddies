
import { GameMode } from "@/lib/types/battleTypes";

// Dialogue types
type DialogueType = 
  | 'card-play'
  | 'attack'
  | 'defense'
  | 'special'
  | 'turn-start'
  | 'mode-change'
  | 'state';

// Naughty mode dialogues with suggestive content
const naughtyDialogues: Record<DialogueType, string[]> = {
  'card-play': [
    "Mmm, that's a naughty move...",
    "Ooh, things are heating up!",
    "Getting frisky with that card, aren't we?",
    "That teddy knows how to work it!",
    "Such a tease with that play!",
    "That bear knows how to make an entrance!",
    "Strutting onto the field with confidence!",
    "That's one seductive play!",
    "Your opponent is definitely feeling that one...",
    "They'll be begging for more after that!",
    "Oh my, look at those moves!",
    "Flaunting all the good stuff!",
    "That teddy has some serious bedroom eyes!",
    "Is it hot in here, or is it just that card?",
    "Playing dirty, I see...",
    "That's the kind of action I'm here for!",
    "Working that field like a pro!",
    "Someone's not playing innocent today!",
    "Oh honey, that bear knows exactly what it's doing!",
    "Sliding that card in smoothly, aren't we?",
    "That teddy is practically undressing the opponent with its eyes!",
    "Such a provocative entrance... I'm blushing!",
    "That card is giving me feelings in places I didn't know I had!",
    "Your teddy is making me feel things I shouldn't feel for stuffed animals!",
    "The way that bear moves should be illegal in at least 12 states!",
    "I'm pretty sure that's not regulation teddy bear behavior!",
    "That bear could make a mint on OnlyTeds with those moves!",
    "Is that bear single? Asking for a friend...",
    "I need to fan myself after watching that entrance!",
    "That teddy just made eye contact with me and now I feel pregnant!",
    "Someone call the bear patrol, because that teddy is dangerously seductive!"
  ],
  'attack': [
    "Giving them a little taste, aren't you?",
    "That's how you make them beg!",
    "Mmm, they definitely felt that one!",
    "Getting rough in all the right ways!",
    "That's how you make them submit!",
    "A little pleasure with that pain?",
    "Making them squirm with delight!",
    "They'll be thinking about that one all night!",
    "Pleasure and pain, perfectly balanced!",
    "They want more, but can they handle it?",
    "Thrusting right into their defenses!",
    "Penetrating their strategy with force!",
    "Dominating every inch of their territory!",
    "Grinding away at their resistance!",
    "Showing them who's on top in this battle!",
    "Making them moan with that powerful move!",
    "That's how you hit all the right spots!",
    "They're completely at your mercy now!",
    "Hitting it from the back... of their defenses!",
    "That bear knows how to use those paws just right!",
    "Stroking their weakness with expert precision!",
    "Fifty shades of bear right there!",
    "Making them feel it deep in their stuffing!",
    "That's the kind of penetration no defense can withstand!",
    "Spread those defenses wide open!",
    "Your bear is absolutely ravishing their strategy!",
    "They'll be walking funny after taking that move!",
    "Going in raw with that attack strategy!",
    "No lube needed for that smooth penetration of their defenses!",
    "That's the spot! Right there! Don't stop!",
    "Keep going at that pace and they'll finish early!",
    "The safe word is 'harder' in this match!"
  ],
  'defense': [
    "Playing hard to get, I see...",
    "No means no, even for teddies!",
    "Holding back the pleasure for now...",
    "Teasing them with resistance!",
    "Making them work for it!",
    "Not giving it up that easily!",
    "Saving yourself for something better?",
    "Such a tease with that defense!",
    "You know they want it, but you're not giving in!",
    "The anticipation is killing them!",
    "Keeping your goodies protected!",
    "Making them beg for access!",
    "Nobody gets past these barriers without consent!",
    "Playing coy, but we all know what you really want!",
    "That defense is tighter than a corset!",
    "You're such a tease with those defenses!",
    "Denying them the satisfaction they crave!",
    "Some things are worth waiting for...",
    "Crossing those legs and saying 'not tonight, honey'!",
    "That bear's chastity belt is firmly locked!",
    "Virginal defense activated! They'll need to try harder!",
    "Holding out for a better offer, smart bear!",
    "That's right, make them beg for it!",
    "Your bear knows its worth and won't give it up easily!",
    "That's one defense that won't be penetrated without consent!",
    "Your bear is playing the 'I have a headache' card!",
    "That teddy is saying 'buy me dinner first'!",
    "Closing those fluffy thighs until they prove their worth!",
    "Making them earn every inch of access!",
    "That's how you keep them coming back for more!",
    "Edging them with that defense, very cruel!"
  ],
  'special': [
    "OH YES! That's the spot!",
    "They'll be BEGGING for mercy after that!",
    "Talk about CLIMACTIC moves!",
    "That move has them TREMBLING with pleasure!",
    "EXPLODING with sensation!",
    "They're completely at your MERCY now!",
    "That bear knows ALL the right buttons to push!",
    "DOMINATING the field with that move!",
    "Making them SUBMIT to your every desire!",
    "RAVISHING performance by that teddy!",
    "That's a MIND-BLOWING finish!",
    "They're SCREAMING for more!",
    "PULSATING with power and pleasure!",
    "That CLIMAX was intense!",
    "THROBBING with dominant energy!",
    "RELEASING all that pent-up tension!",
    "That EXPLOSION of pleasure was worth the wait!",
    "QUIVERING from head to toe after that move!",
    "MULTIPLE FINISHES in one move! Impressive stamina!",
    "They're SQUIRTING stuffing everywhere!",
    "That's what I call a HAPPY ENDING!",
    "RIDING that special move all the way to victory!",
    "PENETRATING to the very core with that finishing move!",
    "CLIMAXING all over the battlefield!",
    "They're WRITHING in ecstatic submission!",
    "That teddy just gave everyone in the audience a SIMULTANEOUS RELEASE!",
    "GUSHING with victorious energy!",
    "That move just made me FINISH my commentary early!",
    "The earth MOVED and angels SANG with that special attack!",
    "That's going to require a cigarette and a nap afterwards!",
    "SHUDDERING with the kind of pleasure that should be illegal!"
  ],
  'turn-start': [
    "Your turn to play, don't hold back...",
    "Show them what pleasure really means...",
    "Time to make your move, make it count...",
    "They're waiting for your touch...",
    "Don't keep them waiting too long...",
    "Give them what they've been craving...",
    "Your opponent is ready for whatever you've got...",
    "Time to demonstrate your skills...",
    "They're vulnerable and waiting...",
    "Show them who's in control...",
    "Time to whip out your best moves...",
    "They're wide open and waiting for you...",
    "Don't be gentle unless they ask for it...",
    "Show them what that teddy can do!",
    "It's your time to dominate the field...",
    "Make them feel every inch of your strategy...",
    "Their body is ready for your next move...",
    "Time to get those teddies dirty!",
    "They're bent over and ready for your move...",
    "Time to slide right into action...",
    "They're waiting in anticipation of your skilled touch...",
    "Show them how you handle your bears...",
    "It's time to unzip that strategy and let it all hang out...",
    "Your opponent is practically dripping with anticipation...",
    "Are you a teddy bear or a teddy bare? Show them!",
    "Time to demonstrate why they call you a master of pleasure...",
    "Your bears are hot and ready to serve it up...",
    "Make your opponent feel things in places they didn't know they had!",
    "Time to make sweet, sweet victory together...",
    "Let's see if you can make your opponent tap out... from pleasure!"
  ],
  'mode-change': [
    "Switching to seduction mode... let the teasing begin!",
    "Time to turn up the heat and make them squirm!",
    "Getting into the mood for some playful persuasion...",
    "Slipping into something more comfortable...",
    "Changing the atmosphere to something more... intimate.",
    "Setting the mood just right...",
    "Softening your approach for maximum effect...",
    "Switching to sweet talk and bedroom eyes...",
    "Time for a gentler, more persuasive approach...",
    "Turning on the charm and turning up the heat!",
    "Taking off the innocent facade...",
    "Stripping down to your true naughty nature!",
    "Unzipping that proper exterior to reveal what's underneath...",
    "Letting your freak flag fly now!",
    "Going from PG to XXX in one smooth move!",
    "Time to show them what happens after dark...",
    "Switching from cuddly to kinky!",
    "Transforming from teddy to temptress!",
    "Taking those bears from the playground to the bedroom!",
    "Switching from plush toy to pleasure toy!",
    "Time to show them what those bears do after the kids go to sleep!",
    "Turning this G-rated match into something very TV-MA!",
    "Those innocent eyes are now giving bedroom stares!",
    "From children's companion to adult entertainment in one mode switch!",
    "Changing from teddy bear to bare teddy!",
    "Those aren't huggy arms anymore, they're grabby hands!",
    "Going from 'cuddle me' to 'handle me' with that mode change!",
    "Switching to the mode that requires viewer discretion!",
    "That's not honey those bears are after anymore!",
    "From bedtime stories to between the sheets action!"
  ],
  'state': [
    "The tension between you two is palpable...",
    "There's electricity in the air tonight...",
    "Your opponent can't take their eyes off you...",
    "You can feel the desire building with every move...",
    "The atmosphere is thick with anticipation...",
    "You're both dancing around the inevitable...",
    "The game is just foreplay at this point...",
    "Every card played just builds the tension...",
    "Your opponent is practically begging for your next move...",
    "The line between pleasure and pain is deliciously thin right now...",
    "You could cut the sexual tension with a knife...",
    "The way you two play with each other is downright filthy...",
    "Every move is like another article of clothing removed...",
    "This isn't a game anymore, it's a seduction...",
    "You're both panting with anticipation now...",
    "This slow burn is driving everyone crazy...",
    "You're both slick with anticipation...",
    "The climax of this match is going to be explosive!",
    "The way you two are eyeing each other... get a room!",
    "I'm starting to feel like a voyeur watching this match!",
    "Someone should throw cold water on these two!",
    "The audience needs a cigarette just watching this intensity!",
    "These bears are about to need an only fans account!",
    "This isn't a card game, it's battery-operated entertainment!",
    "I need to remember this is a family broadcast... or is it?",
    "Those bears are giving each other looks that would make a sailor blush!",
    "The stuffing in these bears isn't the only thing getting hot and bothered!",
    "This match is steamier than a romance novel with the good pages dog-eared!",
    "I'm not saying this is foreplay, but someone should check these bears for consent forms!",
    "The temperature in the arena just rose ten degrees from the heat between these opponents!"
  ]
};

// Nasty mode dialogues with more aggressive content
const nastyDialogues: Record<DialogueType, string[]> = {
  'card-play': [
    "Bringing the pain with that one!",
    "That teddy is out for blood!",
    "Vicious move, love the energy!",
    "That bear doesn't mess around!",
    "Coming in hot and heavy!",
    "Ripping into the battlefield!",
    "That's one aggressive teddy!",
    "Taking no prisoners with that play!",
    "Going straight for the throat!",
    "No mercy with that deployment!",
    "Stuffing that bear right into their face!",
    "Shoving that card down their throat!",
    "That bear is ready to strip them bare!",
    "Thrusting that teddy right into battle!",
    "Pounding the field with that move!",
    "That teddy's going in raw and unfiltered!",
    "Ramming that card into play with force!",
    "That bear is gonna tear them a new one!",
    "Slamming that bear down hard and without warning!",
    "That teddy is going to make them sore tomorrow!",
    "Forcing that bear into places it shouldn't go!",
    "That's one rough entry onto the battlefield!",
    "No lube needed for that dominating entrance!",
    "That bear just violated the PG-13 rating!",
    "Coming in from behind with that surprise entrance!",
    "Stuffing that bear where the sun doesn't shine!",
    "That teddy has some serious daddy issues to work out!",
    "Mounting the battlefield with dominant energy!",
    "That bear knows there's no safe word in this battle!",
    "Treating that opponent like a rental, not caring about the damage!",
    "That teddy doesn't care about consent - it takes what it wants!"
  ],
  'attack': [
    "Ripping them to shreds!",
    "That's gonna leave a mark!",
    "Brutal attack - love to see it!",
    "Making them suffer, aren't we?",
    "Pain is the name of the game!",
    "They'll feel that one tomorrow!",
    "Absolutely savage attack!",
    "Dominating them completely!",
    "That's how you make them submit!",
    "Breaking their will with that move!",
    "Violating all their defenses!",
    "Penetrating right through their guard!",
    "Forcing your way in without mercy!",
    "That's how you make them your plaything!",
    "Bending them over with that powerful thrust!",
    "Ravaging them without a second thought!",
    "They're your toy to break now!",
    "Making them take every inch of that attack!",
    "Destroying their backline defenses without lube!",
    "That bear just committed a war crime with that move!",
    "Fifty Shades of Bear looks tame compared to that attack!",
    "Making them call that teddy 'Daddy' after that move!",
    "That attack just violated every rule of decent society!",
    "Splitting them wide open with that brutal thrust!",
    "That bear is treating them like a rental car with full insurance!",
    "Going in dry with that merciless attack!",
    "Making them bite the pillow with that unexpected assault!",
    "That's going to require therapy to process!",
    "Giving them PTSD with that trauma-inducing move!",
    "That bear just made the Geneva Convention look like suggestions!",
    "Treating that opponent like a disposable pleasure device!"
  ],
  'defense': [
    "Not taking any of their crap!",
    "Shutting them down hard!",
    "Brick wall defense - brutal!",
    "Laughing off their pathetic attempt!",
    "Showing them who's really in charge!",
    "Making them look weak!",
    "That's how you assert dominance!",
    "They can't touch you!",
    "Making them look like amateurs!",
    "Complete shutdown - humiliating for them!",
    "They can beg all they want, you're not giving it up!",
    "Denying them the satisfaction!",
    "Their pathetic attempt couldn't penetrate your defense!",
    "Making them feel inadequate with that wall!",
    "Showing them how impotent their attacks really are!",
    "They'll need something bigger to get through that!",
    "Clenching tight against their feeble thrust!",
    "They're not worthy of getting past your barriers!",
    "That bear just friend-zoned their attack!",
    "Their puny attempt couldn't satisfy a baby bear!",
    "Making them feel like they have inadequate equipment!",
    "That's like trying to break a brick wall with a wet noodle!",
    "Laughing at their inadequate size... of attack!",
    "That bear just handed out a prescription for Viagra!",
    "Telling them 'Sorry, I've had better' with that defense!",
    "That defense is making them question if this is their first time!",
    "Yawning at their pathetic attempt to penetrate!",
    "That bear should ask 'Is it in yet?' after that failed attack!",
    "Checking their watch during that boring attempt!",
    "That defense is like a cold shower for their attack strategy!",
    "Making them feel like they need enhancement pills for their attacks!"
  ],
  'special': [
    "ABSOLUTELY DESTROYING THEM!",
    "COMPLETE AND UTTER DOMINATION!",
    "THEY'RE GETTING WRECKED!",
    "BREAKING THEIR WILL TO FIGHT!",
    "DOMINATING THEM COMPLETELY!",
    "SHOWING NO MERCY WHATSOEVER!",
    "BRUTALIZING THEM INTO SUBMISSION!",
    "THEY'RE AT YOUR COMPLETE MERCY!",
    "THAT'S HOW YOU BREAK SOMEONE!",
    "THEY'LL NEVER RECOVER FROM THAT!",
    "STRETCHING THEIR LIMITS BEYOND CAPACITY!",
    "POUNDING THEM INTO OBLIVION!",
    "IMPALING THEM ON YOUR STRATEGY!",
    "VIOLATING EVERY PART OF THEIR DEFENSES!",
    "FINISHING THEM OFF WITH ONE FINAL THRUST!",
    "ERUPTING ALL OVER THEIR STRATEGY!",
    "CLIMAXING WITH THAT DEVASTATING FINISHER!",
    "MAKING THEM YOUR SUBMISSIVE LITTLE TOY!",
    "DESTROYING THEM SO HARD THEIR ANCESTORS FELT IT!",
    "PENETRATING DEEPER THAN SHOULD BE PHYSICALLY POSSIBLE!",
    "MAKING THEM SCREAM DADDY WITH THAT PUNISHMENT!",
    "VIOLATING THEM IN WAYS THAT SHOULD BE ILLEGAL!",
    "TURNING THEM INTO YOUR PERSONAL PLAYTHING!",
    "THAT SPECIAL MOVE JUST MADE THEM YOUR GIMP!",
    "BREAKING THEM LIKE A CHEAP SEX TOY!",
    "SPLITTING THEM WIDE OPEN WITH NO REGARD!",
    "MAKING THEM BEG FOR MERCY THEY WON'T RECEIVE!",
    "TREATING THEM LIKE A DISPOSABLE PLEASURE OBJECT!",
    "DESTROYING ANY DIGNITY THEY HAD LEFT!",
    "WRECKING THEM HARDER THAN A RENTAL CAR!",
    "MAKING THEM YOUR LITTLE TEDDY SLAVE WITH THAT FINISHER!"
  ],
  'turn-start': [
    "Time to inflict some real pain...",
    "Show them what suffering means...",
    "Make them regret challenging you...",
    "Break their spirit this turn...",
    "Don't hold back - destroy them...",
    "Time to assert your dominance...",
    "Make them submit to your power...",
    "Show them who the real predator is...",
    "Their weakness is your opportunity...",
    "Time to crush their resistance...",
    "Time to bend them to your will...",
    "Make them your plaything this turn...",
    "Show them what it means to be dominated...",
    "Time to violate their strategy completely...",
    "They're about to feel your full length and power...",
    "Make them beg for mercy with your next move...",
    "Time to make them whimper and moan...",
    "Show them what true domination feels like...",
    "Time to break them like the toy they are...",
    "Make them your little submissive teddy...",
    "Show them the meaning of pain and pleasure...",
    "Time to make them cry out for daddy...",
    "Use them like the disposable object they are...",
    "They're just a hole for your strategy to fill...",
    "This turn, make them your personal property...",
    "Time to make them realize their place beneath you...",
    "Show them what happens to teddies that don't obey...",
    "Treat them like the worthless bear they are...",
    "Make them thank you for the abuse you're about to deliver...",
    "Time to leave visible marks that won't fade...",
    "Show them why they should fear your every move..."
  ],
  'mode-change': [
    "Switching to brutality mode... time for pain!",
    "Gloves off now - let's get nasty!",
    "No more playing nice, time to destroy!",
    "Stepping into the darkness...",
    "Switching to maximum aggression!",
    "Time to show them what real pain is!",
    "Unleashing your brutal side now!",
    "No mercy from this point forward!",
    "Shifting into destruction mode!",
    "Time to make them truly suffer!",
    "Stripping off the niceties to reveal your cruel core!",
    "Taking off the safety word for this round!",
    "Going from flirtation to flagellation!",
    "Time to show them your darker appetites!",
    "Switching from playful to punishing!",
    "No safe words allowed in this mode!",
    "Transforming from teddy to torturer!",
    "Time to show them what pain really means!",
    "Switching to 'make them cry' mode!",
    "Time to show them the basement dungeon!",
    "Bringing out the whips and chains now!",
    "Entering the no-consent zone of battle!",
    "Time to show them why they should fear cute teddy bears!",
    "Going from suggestive to sadistic in one mode change!",
    "Unlocking the pain drawer of your toolbox!",
    "Safe, sane, and consensual just went out the window!",
    "Time to explore the dark side of teddy play!",
    "Switching to the mode their therapist will hear about!",
    "Entering the 'things you can't tell your parents about' phase!",
    "Time to show why this game has an Adults Only rating!",
    "Activating the mode that requires a signed liability waiver!"
  ],
  'state': [
    "There's blood in the water now...",
    "The brutality is escalating with every turn...",
    "You can see the fear in their eyes...",
    "They're beginning to understand true pain...",
    "Your dominance is becoming undeniable...",
    "The power dynamic is shifting in your favor...",
    "Their resistance is crumbling under your assault...",
    "The battle is becoming a massacre...",
    "You're breaking them down piece by piece...",
    "Their defeat is becoming inevitable...",
    "They're trembling before your overwhelming force...",
    "You can almost taste their submission...",
    "They're wet with fear at your display of power...",
    "Your brutality has them completely undone...",
    "They're exposed and vulnerable to your every whim...",
    "You've stripped away their every defense...",
    "They're spread open before your merciless attack...",
    "This isn't a game anymore, it's a domination ceremony...",
    "They're just a plaything for your amusement now...",
    "Their eyes show they've accepted their role as your victim...",
    "The crowd is getting uncomfortable with this one-sided abuse...",
    "This has gone beyond competition into something more sinister...",
    "You can see them searching for a safe word that doesn't exist...",
    "They're wondering if they accidentally signed up for something illegal...",
    "That teddy is starting to realize there's no escape from your dungeon...",
    "The safe word is 'harder' and they know it...",
    "Their spirit is broken, now you're just toying with the remains...",
    "This is the kind of match that gets reported to bear protection services...",
    "Stockholm syndrome is setting in as they start to love the abuse...",
    "They've accepted their fate as your personal teddy slave...",
    "This isn't competition anymore, it's ownership."
  ]
};

// Special dialogue for specific card combinations
const specialDialogues: Record<string, string> = {
  "Fluffy Seducer_opponent_naughty": "Your Fluffy Seducer has the opponent completely entranced! They're practically drooling!",
  "Cuddle Brute_opponent_nasty": "Your Cuddle Brute is showing them what real pain feels like! That's going to leave marks!",
  "Domination Teddy_player_nasty": "Your Domination Teddy has established complete control! Time to make them call you 'Master'!",
  "Sweet Talker_player_naughty": "Your Sweet Talker has them wrapped around your finger! They'd do anything for just a taste!",
  "Brutal Bear_opponent_nasty": "Your Brutal Bear is making them whimper with fear! They're begging for mercy already!",
  "Honey Trap_opponent_naughty": "Your Honey Trap has them completely at your mercy! They're stuck and loving every minute of it!",
  "Whipped Cream Warrior_player_naughty": "Your Whipped Cream Warrior is leaving them sticky and satisfied! Time for them to lick it all up!",
  "Bondage Bear_player_nasty": "Your Bondage Bear has them all tied up and begging! The safe word is 'harder'!",
  "Pleasure Plush_opponent_naughty": "Your Pleasure Plush is making them moan with delight! They're experiencing sensations they never knew possible!",
  "Pain Provider_opponent_nasty": "Your Pain Provider has them screaming for more! Their masochistic side is really showing now!",
  "Dommy Mommy_player_nasty": "Your Dommy Mommy has reduced them to a submissive puddle! They'll do anything for Mother's approval!",
  "Sugar Daddy_player_naughty": "Your Sugar Daddy is spoiling them with his special assets! That bear knows how to spend it where it counts!",
  "Safe Word Sally_opponent_naughty": "Your Safe Word Sally knows exactly when to stop... and when to ignore their pleas completely!",
  "Chains of Command_player_nasty": "Your Chains of Command have the opponent completely restrained! They can struggle all they want but they're yours now!",
  "Leather Daddy_player_nasty": "Your Leather Daddy has them on all fours! They'll be walking funny after this match!",
  "Teasing Teddy_opponent_naughty": "Your Teasing Teddy has them on the edge! They're begging for release but it's not coming... yet!",
  "Dominatrix Doll_player_nasty": "Your Dominatrix Doll is wielding that whip with precision! Every strike makes them more obedient!",
  "Silky Seducer_player_naughty": "Your Silky Seducer's touch has them melting! Those paws know exactly where to stroke!",
  "Spanking Bear_opponent_nasty": "Your Spanking Bear has turned their backside cherry red! They've been very naughty and deserve every swat!",
  "Flirty Furball_opponent_naughty": "Your Flirty Furball's suggestive winks are impossible to resist! They're practically throwing themselves at your bear!"
};

// Get random dialogue based on type and mode
export const getRandomDialogue = (
  type: DialogueType, 
  mode: GameMode,
  intensity: number = 0
): string => {
  const dialogues = mode === "naughty" ? naughtyDialogues[type] : nastyDialogues[type];
  
  // If intensity is high, prioritize more explicit dialogues from the end of the list
  if (intensity > 5) {
    const startIndex = Math.max(0, dialogues.length - intensity);
    const intensityDialogues = dialogues.slice(startIndex);
    return intensityDialogues[Math.floor(Math.random() * intensityDialogues.length)];
  }
  
  return dialogues[Math.floor(Math.random() * dialogues.length)];
};

// Get special dialogue for specific card combinations
export const getSpecialDialogue = (
  cardName: string,
  targetCard: string,
  mode: GameMode
): string | null => {
  const key = `${cardName}_${targetCard}_${mode}`;
  return specialDialogues[key] || null;
};

// Get state-based commentary based on gameplay metrics
export const getStateCommentary = (
  playerSeduction: number,
  playerBrutality: number,
  opponentSeduction: number,
  opponentBrutality: number,
  dominanceFactor: number,
  mode: GameMode
): string => {
  // Based on dominance
  if (dominanceFactor > 15) {
    return mode === "naughty" 
      ? "You've got them completely under your spell. They're practically begging for mercy, and maybe something more intimate!"
      : "Complete domination! They're broken and submissive to your every command, reduced to a quivering mess beneath you!";
  }
  
  if (dominanceFactor < -15) {
    return mode === "naughty"
      ? "They've completely enthralled you with their charms. You find yourself wanting to please them in ways that would make a saint blush!"
      : "They've crushed your resistance! You're at their mercy now, a mere plaything for their twisted desires!";
  }
  
  // Based on seduction/brutality levels
  if (mode === "naughty" && playerSeduction > 15) {
    return "Your seductive aura is irresistible! Your opponent can't think straight... they're imagining things that would make this broadcast TV-MA!";
  }
  
  if (mode === "nasty" && playerBrutality > 15) {
    return "Your brutality is terrifying! Your opponent trembles when you make a move, wondering what degrading position you'll force them into next!";
  }
  
  if (mode === "naughty" && opponentSeduction > 15) {
    return "Their charm is overwhelming! You're finding it hard to focus on the game as your mind wanders to the private after-party!";
  }
  
  if (mode === "nasty" && opponentBrutality > 15) {
    return "Their vicious attacks have you on the defensive! You need to regain control before they make you their personal teddy gimp!";
  }
  
  // Default state commentaries
  return getRandomDialogue('state', mode, Math.round(dominanceFactor));
};

