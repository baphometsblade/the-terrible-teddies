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
};

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
