// One round, in a line. The board keeps a tally while you play and reads it
// back when you pass the bottle. Pure, so the words can be tested without
// mounting the table.

export const emptySlip = () => ({ played: 0, damage: 0, kills: 0, face: 0, healed: 0 });

export const notePlay = (slip) => ({ ...(slip || emptySlip()), played: (slip?.played || 0) + 1 });

export const noteHit = (slip, { damage = 0, killed = false, face = 0 } = {}) => {
  const base = slip || emptySlip();
  return {
    ...base,
    damage: base.damage + damage,
    kills: base.kills + (killed ? 1 : 0),
    face: base.face + face,
  };
};

export const noteHeal = (slip, amount) => {
  const base = slip || emptySlip();
  return { ...base, healed: base.healed + (amount || 0) };
};

const LOG_MAX = 80;

/** One house line for the log and the chip under the controls. */
export const slipLine = (slip) => {
  const s = slip || emptySlip();
  if (!s.played && !s.damage && !s.healed && !s.kills && !s.face) return 'Your round: hands stayed in your lap.';
  const bits = [];
  if (s.played) bits.push(`played ${s.played}`);
  if (s.damage) bits.push(`dealt ${s.damage}`);
  if (s.kills) bits.push(`dropped ${s.kills}`);
  if (s.face) bits.push(`${s.face} on the mouth`);
  if (s.healed) bits.push(`patched ${s.healed}`);
  const line = `Your round: ${bits.join(', ')}.`;
  if (line.length <= LOG_MAX) return line;
  return `Your round: dealt ${s.damage}, dropped ${s.kills}.`;
};
