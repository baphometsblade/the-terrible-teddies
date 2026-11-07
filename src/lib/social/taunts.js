// Quick chat for a ghost brawl. The id is the only thing stored. The line
// behind the age gate can wink; the public line is the one a shared slip may
// print. Ids are 1..8, and the server rejects anything else.

export const TAUNTS = Object.freeze([
  { id: 1, short: 'Sit', line: 'Come here. I saved you the sticky stool.', public: 'They saved you a seat.' },
  { id: 2, short: 'Deck', line: 'That deck has been around. Same as you.', public: 'They noticed the effort.' },
  { id: 3, short: 'Drink', line: 'Buy me a drink and I might let you finish.', public: 'They offered a round.' },
  { id: 4, short: 'Eyes', line: 'Eyes up. The rest is not on the menu. Yet.', public: 'They told you to look up.' },
  { id: 5, short: 'Night', line: 'I go all night. Your deck will not.', public: 'They said they had all night.' },
  { id: 6, short: 'Leave', line: 'Leave with me or lose. Both are traditional.', public: 'They offered you the door.' },
  { id: 7, short: 'Stare', line: 'You are staring. Good.', public: 'They caught you looking.' },
  { id: 8, short: 'Gentle', line: 'Tell them I was gentle. Lie if you have to.', public: 'They asked you to be kind.' },
].map((row) => Object.freeze(row)));

const BY_ID = new Map(TAUNTS.map((row) => [row.id, row]));

/** The in-game line, or null when the id is not one of ours. */
export const tauntLine = (id) => BY_ID.get(Number(id))?.line ?? null;

/** The share-safe line, or null. */
export const tauntPublic = (id) => BY_ID.get(Number(id))?.public ?? null;

export const tauntId = (id) => (BY_ID.has(Number(id)) ? Number(id) : null);
