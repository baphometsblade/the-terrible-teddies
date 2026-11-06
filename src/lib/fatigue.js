// Empty-deck fatigue. Each draw you cannot make hurts more than the last,
// so a board of Taunts cannot sit there forever once the keg is dry.
// The first empty draw is 1, the second is 2, and so on. One counter per
// side, for this fight only — it is not part of the save.

export const fatigueForEmptyDraw = (alreadyTaken) => (alreadyTaken || 0) + 1;

/**
 * The log line. The number is said twice, plain, so a screen reader and the
 * battle log agree on how hard it hit. `name` is the opponent's.
 */
export const fatigueLine = (side, amount, name = 'Chuck') => (
  side === 'opponent'
    ? `${name}'s keg is dry. Fatigue ${amount}. He takes ${amount}.`
    : `Your keg is dry. Fatigue ${amount}. You take ${amount}.`
);
