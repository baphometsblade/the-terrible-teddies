// The House's words around the leaderboard's plain parts (the rows, the rank,
// the error message). Pure data and one chooser, so the lines can be rewritten
// without touching the dialog; leaderboardLines.test.js measures each against
// its slot. The heading "Your Ranking", the badge "YOU", the rank numbers and
// the server's own error message stay plain and are not here.

// Under the player's own row: one muted text-xs line, chosen by rank bucket.
// None of them carries a number, so none can ever contradict the row above.
// One line at 320 (the row is 264px wide): LINE_MAX is only a first check.
export const YOU_LINE_MAX = 40;
export const YOU_LINES = Object.freeze({
  first: 'Number one. Nobody gives a shit.',
  podium: 'On the podium. Don’t make it weird.',
  topTen: 'Top ten. The regulars hate you.',
  board: 'On the board. In pencil. Smudged.',
  outside: 'Not on the board. Yet.',
});

/**
 * The line for a player's rank as the Your Ranking row shows it: a number, the
 * 'N+' string for a player past the rows fetched, or anything else ('—' while
 * the rank is unknown), which gets no line at all. `boardSize` is the number of
 * rows fetched (the 'N+' badge is `${boardSize}+`).
 */
export const youLine = (rank, boardSize = 50) => {
  if (rank === `${boardSize}+`) return YOU_LINES.outside;
  if (typeof rank !== 'number' || !Number.isFinite(rank) || rank < 1) return null;
  if (rank === 1) return YOU_LINES.first;
  if (rank <= 3) return YOU_LINES.podium;
  if (rank <= 10) return YOU_LINES.topTen;
  if (rank <= boardSize) return YOU_LINES.board;
  // A real rank past the rows fetched is outside the board, whatever the number.
  return YOU_LINES.outside;
};

// The headings and states.
export const LEADERBOARD_COPY = Object.freeze({
  // Still says the scope (every player, all of time). label-caps beside the
  // globe, one line at 320.
  caption: 'Every bar, ever',
  top: 'Last Ones Standing',
  loading: 'Counting heads.',
  empty: 'Empty. Even Chuck went home, and he lives here.',
  // Under the server's raw message, never in place of it: a hedge, not a claim
  // about the cause, so it can never be wrong.
  errorSignoff: 'Not you. Probably. — Mgmt.',
  // toRow()'s name for a row with no username (the server normally fills one).
  fallbackName: 'Name Withheld',
});
