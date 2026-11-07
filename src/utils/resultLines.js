// What the result panel says when a battle ends: a headline and the line under
// it, for a win and for a loss. They lived inline in GameBoard.jsx as one
// string each, so every battle ended on the same two sentences; they are lists
// of variants now, picked once when the game ends (pickResultCopy), so the
// final copy can be dropped in here without touching the panel. The Victory
// and Defeat labels the dialog is found by are not here and do not change.
//
// Every variant that shipped before the lists is still in them.
import { OPPONENT_NAME } from './teddyTalk';
import { RECEIPT_FOOTERS, pickLine } from '@/lib/houseLines';

// The first line of each list is the one the panel shipped with; the rest are
// the copy deck's (the House narrating: flat, dry, no exclamation marks except
// the shipped headline's). Write OPPONENT_NAME, never the bare name, so the
// sublines follow the persona.
export const RESULT_TITLES = {
  win: [
    'TOTAL FLUFFING VICTORY!',
    "Chuck finished early.",
    "He'll feel that in the morning.",
    "Chuck's been cut off.",
    "Chuck is calling it a nap.",
    "A beautiful beating.",
    "Face down in the peanuts.",
    "Pleasure doing business.",
    "Uncalled for. Do it again.",
    "Chuck got fucked up.",
    "Sent home in a stranger's coat.",
    "He finished. Loudly. Early.",
    "The room key is yours now.",
  ],
  loss: [
    'ABSOLUTELY UNSTUFFED!',
    "Closed casket. Open bar.",
    "Rough night. Worse morning.",
    "You lost to Chuck. Sit.",
    "That went fucking poorly.",
    "Shown the door.",
    "The floor won.",
    "Chuck won. Hydrate.",
    "The lights came on.",
    "Stuffing on the ceiling.",
    "You finished early. Again.",
    "Walk of shame, still loading.",
    "The headboard won. Not you.",
  ],
};

export const RESULT_SUBLINES = {
  win: [
    `${OPPONENT_NAME} rage-quit into the toy chest.`,
    `${OPPONENT_NAME} is crying in the walk-in cooler. Give him a minute.`,
    `${OPPONENT_NAME} is in the bathroom, texting his ex. It's going badly.`,
    `${OPPONENT_NAME} went to scream at a parked car. It isn't his.`,
    `${OPPONENT_NAME} says he's fine. He is eating the garnish.`,
    `${OPPONENT_NAME} is crying in someone's coat. Nobody knows whose.`,
    `${OPPONENT_NAME} is explaining it to the jukebox.`,
    `${OPPONENT_NAME} is arguing with the hand dryer. It's winning.`,
    `He went home alone. He's had practice.`,
    `${OPPONENT_NAME} is blaming the lighting. The lighting is fine.`,
    `He's calling his ex. The bar looks away.`,
    `He ordered a water. The bar went quiet.`,
    `He wants a recount. He counts to four.`,
    `${OPPONENT_NAME} is in the alley, arguing with his trousers.`,
    `He is texting three people. None of them are you.`,
    `The bartender cut him off and kept his room key.`,
  ],
  loss: [
    `${OPPONENT_NAME} is doing a victory lap. It's insufferable.`,
    `He's buying a round to celebrate. On your tab.`,
    `He's telling the whole bar. In detail. With gestures.`,
    `${OPPONENT_NAME} is already telling the story. You had a sword.`,
    `He's dancing on the bar. The bartender has the hose.`,
    `${OPPONENT_NAME} is holding a trophy. It's a ketchup bottle.`,
    `${OPPONENT_NAME} is bragging to a stranger. It's a coat rack.`,
    `${OPPONENT_NAME} is wearing your dignity as a hat. It suits him.`,
    `${OPPONENT_NAME} has taken his shirt off. He wasn't wearing one.`,
    `${OPPONENT_NAME} declared today a holiday. Staff were not told.`,
    `He called his ex to tell her. She picked up this time.`,
    `${OPPONENT_NAME} has taken your stool. He is not giving it back.`,
    `${OPPONENT_NAME} is celebrating in the restroom. Alone. At length.`,
    `He is telling the story with his hips. Staff look away.`,
    `${OPPONENT_NAME} bought a round and put it on your card.`,
    `The room still smells like him. Open a window.`,
  ],
};

/**
 * Everything the panel says that varies, picked together: the headline, the
 * line under it and the receipt's footer. `last` is what the previous game
 * picked (this function's own result), so Play Again never answers with the
 * same line it just showed. Call it once, when the game ends, and keep the
 * result: the panel re-renders, and a pick made while rendering would change
 * under the player.
 */
export const pickResultCopy = (won, last = null) => {
  const side = won ? 'win' : 'loss';
  return {
    title: pickLine(RESULT_TITLES[side], last?.title),
    subline: pickLine(RESULT_SUBLINES[side], last?.subline),
    footer: pickLine(RECEIPT_FOOTERS, last?.footer),
  };
};
