// Chuck, your rival: a smug, trash-talking teddy with a bar tab and a fragile
// ego. Pure data + a picker so the voice is unit-testable and lives in one
// place. Bubbles are decorative flavor — the battle log stays the record.

export const OPPONENT_NAME = 'Chuck';

export const QUIPS = {
  gameStart: [
    "Let's make this quick — happy hour started ten minutes ago.",
    "I've beaten the stuffing out of tougher bears before breakfast.",
    "Hope you signed a waiver, sweetheart.",
    "Fresh meat! I LOVE fresh meat.",
    "I'm gonna unstuff you and sell the fluff.",
    "My therapist says I need this. Don't take it personally.",
  ],
  // The same opener when the battle begins between midnight and five in the
  // morning, local time (startPoolFor). Card-agnostic, like gameStart.
  gameStartLate: [
    "It's past midnight and you chose me. I'm flattered.",
    "Nobody good is awake. So here we are.",
    "Bold of you to fight me at this hour. I respect it.",
    "Midnight. The bar is empty. Just us and our decisions.",
    "A booty call with fists, at this hour? My favorite kind.",
    "Sun's up soon. We'll both pretend this never happened.",
  ],
  // The first time either side is down to LAST_CALL_HP (the house lights come
  // up). Card-agnostic, and said whichever side is the one in trouble, so none
  // of them states whose HP it is: they are Chuck's bluster either way.
  lastCall: [
    "Last call, sweetheart. Drink up.",
    "Lights up, goggles off. You were never that cute.",
    "One leaves on a stretcher. The other, with whoever's left.",
    "Lights up. Nobody looks good. Especially you.",
    "Last call! Get a good look at what you lost.",
    "House lights are on, and you're going home alone. Again.",
    "Somebody call you a cab. A hearse. Whatever.",
    "I've got a bottle, a bad idea and no standards. Pick two.",
    "Lights up! Find someone to go home with before they see you.",
    "Last call for booze. Last call for dignity. I'm taking both.",
    "Jukebox dead, lights up, someone crying in the bathroom. Me.",
    "Lights up. Start the walk of shame. I'll hold the door.",
    "Last call. Last chance to get lucky. Judging by you, no.",
  ],
  oppPlays: [
    "Say hello to my fluffy little friend.",
    "Fresh outta the toy box and full of bad intentions.",
    "This one bites. I didn't train him — he came like that.",
    "Clock in, buddy. Daddy needs a win.",
    "Found this guy behind a dumpster. He's perfect.",
  ],
  oppKills: [
    "Aww, was that your favorite? Tragic.",
    "He's with the stuffing angels now.",
    "Back to the build-a-morgue with that one.",
    "That's a certified unstuffing, baby!",
    "Someone grab a dustpan.",
    "He had a good run. It's over now. LOL.",
  ],
  oppHitsFace: [
    "Right in the beans!",
    "That's gonna leave a seam.",
    "Feel that? That's bedtime, baby.",
    "Your face and my fist are becoming best friends.",
    "Ooh, sorry. Wait — no I'm not.",
  ],
  oppLosesCreature: [
    "You MONSTER. He had a family. Of decorative pillows.",
    "That bear owed me money, you son of a stitch.",
    "Okay. That one stung.",
    "He died as he lived: badly.",
    "I want a lawyer.",
  ],
  oppTakesFaceHit: [
    "OW. Okay. OKAY. Now I'm cranky.",
    "I felt that in my beans.",
    "You little furball—",
    "That the best you got? ...Don't answer that.",
    "I've had hangovers worse than you. Barely.",
  ],
  oppNearDeath: [
    "Let's talk about this like adults. Adult-ish.",
    "I've been drunker than this and still won.",
    "This is fine. THIS IS FINE.",
    "You wouldn't hit a bear with glasses. I can find glasses.",
    "My life just flashed before my button eyes. Mostly bar tabs.",
  ],
  playerRally: [
    "Oh COME ON. That's cheating-adjacent!",
    "Who let you have a comeback mechanic?!",
    "BOOOO. Boo this bear.",
    "Great. Now they're pumped AND smug.",
  ],
  oppWins: [
    "Get stuffed, kid. Literally.",
    "Tell your deck it sucked. Byeee.",
    "I'd say good game, but I was raised honest.",
    "Drinks are on you. Forever.",
  ],
  oppLoses: [
    "This is rigged. I want a rematch and a juice box.",
    "I let you win. Out of pity. Shut up.",
    "My beans... my beautiful beans...",
    "You haven't seen the last of me. I literally live here.",
  ],
  // The player's Teddy Emote (Battle Pass exclusive) — trash talk fired at
  // Chuck on demand. Same register as his own lines: crude, never explicit.
  playerEmote: [
    "Your deck called. It wants a lawyer.",
    "I've seen scarier bears in a claw machine.",
    "Smell that? That's your win rate.",
    "My grandma slaps harder, and she's a beanbag.",
    "Cry about it, fuzzball.",
    "You play like your stitching's loose.",
  ],
};

// Which opening pool a battle starts with: past midnight and before five in
// the morning, by the player's own clock, Chuck opens with 'gameStartLate'.
// getHours() is the local hour, so a daylight-saving change cannot skew it,
// and the caller reads the clock once, at the deal.
export const LATE_UNTIL_HOUR = 5;
export const startPoolFor = (now = new Date()) =>
  (now.getHours() < LATE_UNTIL_HOUR ? 'gameStartLate' : 'gameStart');

/**
 * Pick a random quip from a pool, never repeating the previous line back to
 * back. Unknown pools return null so a bad key can never crash a battle.
 */
export const pickQuip = (pool, lastQuip = null) => {
  const lines = QUIPS[pool];
  if (!lines || lines.length === 0) return null;
  const options = lines.length > 1 ? lines.filter((l) => l !== lastQuip) : lines;
  return options[Math.floor(Math.random() * options.length)];
};
