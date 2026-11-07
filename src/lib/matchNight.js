// The recap and the MVP. Pure, so the result panel can show what the night
// actually did without replaying the animation.

export const pushRecap = (lines, text) => {
  const next = [...(lines || []), text].filter(Boolean);
  return next.slice(-24);
};

export const tallyMvp = (tally, { id, name, damage }) => {
  if (!id || !damage) return tally || {};
  const prev = (tally || {})[id] || { id, name, damage: 0 };
  return { ...tally, [id]: { ...prev, name: name || prev.name, damage: prev.damage + damage } };
};

export const pickMvp = (tally) => {
  const rows = Object.values(tally || {});
  if (!rows.length) return null;
  return rows.reduce((best, row) => (row.damage > best.damage ? row : best));
};

export const mvpLine = (mvp) => (
  mvp
    ? `MVP: ${mvp.name}, ${mvp.damage} on the night.`
    : 'MVP: nobody. Hands stayed polite.'
);
