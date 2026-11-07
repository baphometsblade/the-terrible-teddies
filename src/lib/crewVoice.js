// A one-line signature for the crew Chuck brought. Matched on a word in the
// crew name so a new name still gets a voice. House voice, one line.

const VOICES = [
  [/dumpster|alley|cartel/i, 'They sent their love. It smells like the alley.'],
  [/repo|tab|bail|debt/i, 'They keep receipts. Yours is already open.'],
  [/karaoke|tequila|drunk|hair/i, 'They warmed up in the car. Badly.'],
  [/last-call|closing|walk|shame/i, 'They were asked to leave somewhere else first.'],
  [/staff|door|bouncer/i, 'They work here. That is not a comfort.'],
];

const FALLBACK = 'They came dressed for trouble and underdressed for the cold.';

export const crewTaunt = (crewName = '') => {
  const hit = VOICES.find(([pattern]) => pattern.test(crewName));
  return hit ? hit[1] : FALLBACK;
};
