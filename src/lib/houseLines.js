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
  'Blood is not a tip. - Mgmt.',
  'We saw everything. We said nothing. - Mgmt.',
  'The mop bucket is not a throne. - Mgmt.',
  'Please stop bleeding on the felt. - Mgmt.',
  'Stuffing in the sink again. Really. - Mgmt.',
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

// The board's recurring lines, in the House's voice, as lists the board picks
// from (pickLine) when the moment comes: a turn banner is picked once per
// banner, the thinking line once per Chuck turn, a log line once as it is
// written, never while rendering. The first line of each list is the one the
// board shipped with; the rest are the copy deck's. Every variant keeps the
// facts of the shipped line (whose turn it is, which card, the damage and the
// HP left): only the voice around them varies.
//
// `{card}`, `{attacker}`, `{target}`, `{dmg}` and `{hp}` are filled by
// fillLine. Chuck's pools are in teddyTalk.js; the result panel's in
// resultLines.js.
export const BOARD_LINES = {
  // Decorative, 1.3 s, aria-hidden. 13 characters is what the banner holds on
  // the felt at 320px (houseLines.test.js).
  bannerPlayer: ['Your turn', "You're up", 'Your shot', 'Your swing'],
  bannerChuck: [`${OPPONENT_NAME}'s turn`, `${OPPONENT_NAME}'s up`, `${OPPONENT_NAME} swings`, `${OPPONENT_NAME}'s shot`],
  // The row under the table on Chuck's turn (text-xs italic, aria-hidden).
  thinking: [
    `${OPPONENT_NAME} is making his move…`,
    `${OPPONENT_NAME} is making a terrible decision…`,
    `${OPPONENT_NAME} is finishing his drink first…`,
    `${OPPONENT_NAME} is reading his cards upside down…`,
    `${OPPONENT_NAME} is consulting his liver…`,
    `${OPPONENT_NAME} is cheating, probably…`,
    `${OPPONENT_NAME} is checking his pockets for a plan…`,
    `${OPPONENT_NAME} is trying to remember the rules…`,
  ],
  // The log, which a screen reader reads out. The first turn's "Your turn.
  // Make it hurt." is not in these: it is pinned and it opens the game.
  yourTurn: [
    'Your turn. Get him.',
    `Your turn. ${OPPONENT_NAME} is still talking.`,
    'Your turn. The bar is on your side. Quietly.',
    'Your turn. The bartender is pretending not to watch.',
    "Your turn. He's still standing. Fix that.",
  ],
  chuckTurn: [
    `${OPPONENT_NAME}'s turn. Brace your beans.`,
    `${OPPONENT_NAME}'s turn. Hide your drink.`,
    `${OPPONENT_NAME}'s turn. He's had four. He says two.`,
    `${OPPONENT_NAME}'s turn. He has a plan. It's a bad one.`,
    `${OPPONENT_NAME}'s turn. Somebody count the exits.`,
    `${OPPONENT_NAME}'s turn. Somebody hide the good bottles.`,
  ],
  endTurn: [
    'Ending turn...',
    `Ending turn. Your move, ${OPPONENT_NAME}.`,
    'Ending turn. Hands to yourself.',
    'Ending turn. Passing the bottle.',
  ],
  // {card} stays early in each line so the phone ticker's single-line cut
  // keeps the name. Chuck's side only: every card he plays can be the
  // Custody-Battle Cub, so none of these is anything but plain about it.
  chuckPlays: [
    `${OPPONENT_NAME} slammed down {card}`,
    `${OPPONENT_NAME} dragged in {card}`,
    `${OPPONENT_NAME} threw {card} on the felt`,
    `${OPPONENT_NAME} pulled {card} out of his coat`,
    `${OPPONENT_NAME} sent in {card}. Nobody asked.`,
  ],
  // Chuck's creature hitting yours / your face. Only the verb is voiced.
  oppHit: [
    '{attacker} roughed up {target} for {dmg} ({hp} HP left)',
    '{attacker} worked {target} over for {dmg} ({hp} HP left)',
    '{attacker} slapped {target} around for {dmg} ({hp} HP left)',
    '{attacker} leaned on {target} for {dmg} ({hp} HP left)',
  ],
  oppFace: [
    '{attacker} socked you right in the face for {dmg}!',
    '{attacker} clocked you right in the face for {dmg}!',
    '{attacker} popped you right in the face for {dmg}!',
  ],
  // Every variant keeps the "You conceded" prefix the specs find it by.
  conceded: [
    `You conceded. ${OPPONENT_NAME} is doing a little dance.`,
    `You conceded. ${OPPONENT_NAME} is dancing on the pool table. Pants optional.`,
    `You conceded. ${OPPONENT_NAME} is doing a little dance. Nobody asked for the hips.`,
    `You conceded. ${OPPONENT_NAME} is accepting congratulations from a plant.`,
  ],
};

/** Fill a board line's `{name}` slots. A slot with no value stays as written. */
export const fillLine = (template, values = {}) =>
  template.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole));

// The unplayable-move toasts' titles are in battleUtils.js and GameBoard.jsx
// beside the rule they answer; the result panel's upsell sits above its button.

// A line of the House's under the plain question in the leave dialog: one for
// the menu's "Leave this battle?" and one for Concede. Decorative and
// aria-hidden, a sibling of the dialog's body (the body, the title and both
// buttons stay literal). Cut first if the dialog gets tall on a short phone.
export const LEAVE_ASIDE = {
  leave: `Your seat stays warm. ${OPPONENT_NAME} will sit in it.`,
  concede: `${OPPONENT_NAME} will tell everyone he won. He'll be right.`,
};
