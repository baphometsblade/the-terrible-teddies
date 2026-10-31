// House ranks: how well the bar knows you. A rank is DERIVED from the level and
// stored nowhere: no store field, so nothing for the save, the cloud save or a
// reset to carry (SAVE_FIELDS and DEVICE_FIELDS never hear of it). Pure, with
// no imports, because App's level-up toast reads it on the boot path.
//
// Every word the player reads lives in HOUSE_RANKS, so the ladder can be
// rewritten (its lines, its rungs) without touching the screens that draw it;
// houseRank.test.js measures each line against its slot.
//
//   name      the rank's name, a small-caps label on Player Stats
//             (RANK_NAME_MAX characters).
//   promoted  the line the level-up toast adds when a level-up reaches this
//             rank (RANK_PROMOTED_MAX characters). It is its own sentence, not
//             "You're a {name}", which does not read for every name. The
//             first rung is nobody's promotion, so its line is never shown;
//             it is written anyway so the table has no hole.
//   min       the first level that holds the rank.
//
// Nothing here may read like a paid membership: the game sells a Premium Pass,
// and a rank called VIP or Gold would be taken for something bought.
export const HOUSE_RANKS = Object.freeze([
  { min: 1, name: 'Walk-In', promoted: 'You came in. That counts.' },
  { min: 5, name: 'Regular', promoted: "You're a regular now." },
  { min: 10, name: 'Has a Usual', promoted: 'Your usual. No questions.' },
  { min: 15, name: 'Barfly', promoted: 'Your stool has a dent.' },
  { min: 20, name: 'Fixture', promoted: 'Nobody saw you arrive.' },
  { min: 25, name: 'Part of the Furniture', promoted: 'Comes with the lease.' },
].map((row) => Object.freeze(row)));

// The slots the lines go in. The name is a 21-character label ("Part of the
// Furniture") in Player Stats' header. The promotion line is a toast's: over a
// dialog on a phone the toast holds a one-line title and two lines of
// description, and the bonus takes the first of them, so the line has to fit
// the second whole (e2e/shell.spec.js measures the longest at every width).
export const RANK_NAME_MAX = 21;
export const RANK_PROMOTED_MAX = 25;

const rowAt = (level) => {
  const n = Math.floor(Number(level));
  // Anything that is not a level from 1 up (a save's repaired gap, NaN) gets
  // the first rung rather than nothing.
  let found = HOUSE_RANKS[0];
  for (const row of HOUSE_RANKS) {
    if (row.min <= n) found = row;
    else break;
  }
  return found;
};

/** The rank row a level holds. Same row object each time, so rows compare with ===. */
export const houseRank = (level) => rowAt(level);

/**
 * The rank a level-up arrives at, or null if it stays on the rung it was on.
 * A jump over several rungs (a big XP reward) arrives at the highest, once:
 * the toast says one promotion, not one per rung. Only a rise counts, so a
 * level that falls (a reset) promotes nobody.
 */
export const rankUp = (fromLevel, toLevel) => {
  const before = rowAt(fromLevel);
  const after = rowAt(toLevel);
  return HOUSE_RANKS.indexOf(after) > HOUSE_RANKS.indexOf(before) ? after : null;
};

/**
 * The levels a rank covers: `{ from, to }`, where `to` is null for the top
 * rung, which has no end. Player Stats prints it beside the rank, so the label
 * says which level it came from and where it runs out.
 */
export const rankSpan = (level) => {
  const row = rowAt(level);
  const next = HOUSE_RANKS[HOUSE_RANKS.indexOf(row) + 1];
  return { from: row.min, to: next ? next.min - 1 : null };
};
