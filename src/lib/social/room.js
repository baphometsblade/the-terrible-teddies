// Rules for the back room: gangs, the weekly cup, the ribbon a week leaves
// behind, and who you may call a rival. Pure, so the screen and the migration
// can share the edges.

export const GANG_MAX = 12;
export const CUP_ROUNDS = 3;
export const REFERRAL_BONUS = 15;
export const REFERRAL_CAP = 5;

export const RIBBONS = Object.freeze([
  { maxPlace: 1, name: 'Top stool' },
  { maxPlace: 3, name: 'On the podium' },
  { maxPlace: 10, name: 'Trouble' },
  { maxPlace: Infinity, name: 'Showed up' },
]);

/** A ribbon for a week you actually played. Place is 1-based. */
export const ribbonFor = (place, played) => {
  if (!played) return null;
  const n = Math.floor(Number(place));
  if (!Number.isFinite(n) || n < 1) return null;
  for (const row of RIBBONS) {
    if (n <= row.maxPlace) return row.name;
  }
  return null;
};

/** Gang tag: 3 or 4 letters. Stored uppercased. */
export const cleanTag = (value) => {
  const tag = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{3,4}$/.test(tag) ? tag : '';
};

/** Gang name uses the same boring charset as a player name. */
export const cleanGangName = (value) => {
  const name = String(value ?? '').trim();
  if (name.length < 3 || name.length > 20) return '';
  if (!/^[A-Za-z0-9 _.!?-]+$/.test(name)) return '';
  return name;
};

export const REPORT_REASONS = Object.freeze([
  { id: 'name', label: 'Their name is a problem' },
  { id: 'cheat', label: 'That finish smelled wrong' },
  { id: 'spam', label: 'They will not stop' },
]);

export const reportReason = (id) => REPORT_REASONS.some((row) => row.id === id);
