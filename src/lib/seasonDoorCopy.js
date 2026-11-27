// The menu's sign for a season the server has not opened yet. House voice:
// deadpan, no exclamation marks, and no claim that packs, odds or grants
// have moved. The clock string is formatted by the caller from the server's
// now (`opensInMs`); this module does not read a clock.

export const DOOR_KICKER = "Door's shut";
export const DOOR_BUTTON = "Who's coming";
export const DOOR_WAIT = 'The list is written. The packs are not.';
export const DOOR_ODDS = 'Same odds once it opens. Nothing early.';
export const DOOR_UNKNOWN = 'The server has not said when. Packs stay shut.';
export const DOOR_DUE = 'Due now. Packs stay shut until the server opens the door.';

const COUNT_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The shop's peek. The count is the server row's card list, not a slogan. */
export const peekLine = (count) => {
  const word = COUNT_WORDS[count];
  const who = count === 1 ? 'This one stays' : word ? `These ${word} stay` : 'These cards stay';
  return `${who} out of every pack until the server opens the door. A pack you buy and a pack you earn will use the same odds. Nothing early.`;
};

/** The brass line. Empty when there is no clock to show. */
export const doorClock = (clock) => (clock ? `Opens in ${clock}` : '');
