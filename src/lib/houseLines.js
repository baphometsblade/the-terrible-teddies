// The house's own printed voice: what the bar writes on the bill and says when
// the lights come up. Pure data and one picker, so every line can be measured
// against the slot it has to fit (houseLines.test.js holds the budgets) and the
// final copy can be dropped in here without touching the layout or the logic
// around it.
//
// The Tab (src/components/GameBoard/BarTab.jsx) prints these and the board's
// last call reads them. Chuck's own lines are in src/utils/teddyTalk.js and
// the result panel's headline and sub-line in src/utils/resultLines.js.
import { OPPONENT_NAME } from '@/utils/teddyTalk';

// One rotating line at the foot of the receipt. At 320px a receipt line holds
// about 32 characters of the receipt's type, so a footer runs to a second line
// there; the test caps each so it never needs a third.
// Chuck and dignity stay out of the footers: the panel above already carries
// him, and the lost-dignity joke is the result lines'. Plain jokes about the night, never about the player's wallet: the footer
// sits right under the coins the battle paid.
export const RECEIPT_FOOTERS = [
  'Tip the bartender. She heard the stall.',
  'Tip your bartender. She saw everything.',
  'Leave quietly. The neighbors have lawyers.',
  'Your Uber driver knows. He will not say.',
  'Your server: nobody. Get it yourself.',
  'Hickeys sold separately. Regrets are free.',
  'Memories not guaranteed. Neither is the cab.',
  'Please do not text your ex from the table.',
  'Stains on this receipt are not our fault.',
  'Keep this receipt. Evidence is evidence.',
  'Not valid as proof you were here. Or sober.',
  'Cards were harmed. Nobody is sorry.',
];

/**
 * A line from a list, never the same one twice running (pass the last one
 * picked). The same rule as pickQuip, for the lines that are not Chuck's.
 * An empty or missing list gives null, so a bad key can never crash a screen.
 */
export const pickLine = (list, last = null) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  const options = list.length > 1 ? list.filter((line) => line !== last) : list;
  return options[Math.floor(Math.random() * options.length)];
};

// Last call: the first time either side is down to LAST_CALL_HP, the house
// lights come up. The banner is a title-sized line on the felt, in the turn
// banner's place; the log line is the accessible record of the whole moment.
export const LAST_CALL_BANNER = 'Last call';

/**
 * The log line for it. `side` is who is down, 'player' or 'opponent', and `hp`
 * what they have left.
 */
export const lastCallLog = (side, hp) =>
  `Last call. House lights up — ${side === 'player' ? "you're" : `${OPPONENT_NAME}'s`} down to ${hp} HP.`;

// The words on The Tab. Each row label sits on a receipt line with its figure
// and a dotted leader between; "title" is decoration (aria-hidden) and
// "header" is the receipt's header line, the name the result panel's rewards
// have always had.
const TAB_COPY_STATUS = 'STILL OPEN';
export const TAB_COPY = {
  title: 'THE TAB',
  header: 'Battle Rewards',
  cards: 'Cards played',
  damage: 'Damage dealt',
  healed: 'Healed',
  taken: 'Damage taken',
  xp: 'XP',
  coins: 'Coins',
  chuck: `${OPPONENT_NAME.toUpperCase()}'S TAB`,
  chuckStatus: TAB_COPY_STATUS,
  // What a screen reader hears for Chuck's bill: built from the visible status
  // so the two cannot drift apart.
  chuckSpoken: (figure) => `${figure} damage, ${TAB_COPY_STATUS.toLowerCase()}`,
};
