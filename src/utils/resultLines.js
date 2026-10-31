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

export const RESULT_TITLES = {
  win: ['TOTAL FLUFFING VICTORY!'],
  loss: ['ABSOLUTELY UNSTUFFED!'],
};

export const RESULT_SUBLINES = {
  win: [
    `${OPPONENT_NAME} rage-quit into the toy chest.`,
    `${OPPONENT_NAME} is crying in the walk-in cooler. Give him a minute.`,
    `${OPPONENT_NAME} is in the bathroom, texting his ex. It's going badly.`,
    `${OPPONENT_NAME} says he's fine. He is eating the garnish.`,
  ],
  loss: [
    `${OPPONENT_NAME} is doing a victory lap. It's insufferable.`,
    `${OPPONENT_NAME}'s buying a round to celebrate. On your tab.`,
    `${OPPONENT_NAME} is telling the whole bar. In detail. With gestures.`,
    `${OPPONENT_NAME} is wearing your dignity as a hat. It suits him.`,
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
