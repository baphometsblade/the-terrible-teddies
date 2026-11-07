// A tab the house runs beside the season pass. Reaching the level is the
// whole rule. Coins and ordinary packs only.

export const LEVEL_TRACK = Object.freeze([
  { level: 2, coins: 40, packs: 0, line: 'You stayed for a second.' },
  { level: 3, coins: 0, packs: 1, line: 'A pack, for looking comfortable.' },
  { level: 5, coins: 80, packs: 0, line: 'The bouncer nodded. Once.' },
  { level: 8, coins: 0, packs: 1, line: 'They started a tab without asking.' },
  { level: 10, coins: 150, packs: 0, line: 'Third-date money.' },
  { level: 15, coins: 0, packs: 2, line: 'Two packs. Hide one.' },
  { level: 20, coins: 250, packs: 0, line: 'Your usual, already poured.' },
  { level: 25, coins: 400, packs: 1, line: 'Too old, and the round is on them.' },
  { level: 35, coins: 0, packs: 2, line: 'The good shelf. Don’t tell the new ones.' },
  { level: 50, coins: 800, packs: 1, line: 'House rules. Your round still exists.' },
].map((row) => Object.freeze(row)));

export const levelMark = (level) => `level_${level}`;

export const trackRow = (level) => LEVEL_TRACK.find((row) => row.level === level) || null;
