// Tonight's fight. One seeded sitting per local calendar day: the same
// modifier and the same crew for everyone, the date taken from the player's
// own clock. The rules line is plain. The name and the flavour are the bar.
// No import of the card catalog: the store imports this module, and the
// catalog lives in the store.

export const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const previousLocalDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
};

const hashKey = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
};

// Names and flavour are the joke. `rules` is what the fight actually does.
export const MODIFIERS = Object.freeze([
  {
    id: 'open-bar',
    name: 'Open Bar',
    flavour: 'First round is on the house. The second one bills your ex.',
    rules: 'Both sides have 1 extra energy on their first turn.',
    extraEnergy: 1,
  },
  {
    id: 'last-call',
    name: 'Last Call at Eight',
    flavour: 'The lights come up on turn 8, finished or not.',
    rules: 'From turn 8, both sides take fatigue at the start of the turn.',
    fatigueFromTurn: 8,
  },
  {
    id: 'short-pour',
    name: 'Short Pour',
    flavour: 'Same tab. Less in the glass.',
    rules: 'Both sides start at 25 health.',
    startingHealth: 25,
  },
  {
    id: 'shaved-dice',
    name: 'Shaved Dice',
    flavour: 'Chuck swears he did not touch them. The dice disagree.',
    rules: "Chuck's creatures have +1 attack.",
    opponentAttack: 1,
  },
  {
    id: 'happy-ending',
    name: 'Happy Ending',
    flavour: 'The masseuse clocks out. The tab does not.',
    rules: 'Both sides have 1 extra energy on their first turn.',
    extraEnergy: 1,
  },
  {
    id: 'two-for-one',
    name: 'Two for One',
    flavour: 'Cheap drinks, cheaper decisions, same hangover.',
    rules: 'Both sides start at 25 health.',
    startingHealth: 25,
  },
  {
    id: 'one-last-round',
    name: 'One Last Round',
    flavour: 'The bottle is down. The night is not.',
    rules: "Chuck's creatures have +1 attack.",
    opponentAttack: 1,
  },
]);

// The card list is the fight. Order is shuffled with the day's seed inside
// the deal, so the opener moves and the crew does not.
export const CREWS = Object.freeze([
  { id: 'wingmen', name: 'The Wrong-Number Wingmen', cards: [4, 2, 1, 6, 50, 52, 7, 30] },
  { id: 'door', name: 'The Door Staff', cards: [56, 6, 54, 20, 63, 8, 33, 40] },
  { id: 'royals', name: 'The Disgraced', cards: [16, 14, 18, 66, 67, 64, 60, 43] },
  { id: 'closing', name: 'The Closing Shift', cards: [69, 21, 68, 65, 62, 61, 34, 41] },
  { id: 'hendo', name: 'The Hen Do', cards: ['hd-sash', 'hd-veil', 'hd-chorus', 'hd-shot', 'hd-lap', 'hd-bree', 'hd-honour', 'hd-petra'] },
  { id: 'chuck', name: "Chuck's Own", cards: ['ck-chuck', 'ck-closing', 'ck-offduty', 'ck-rita', 'ck-tabitha', 'ck-last-orders', 'ck-top-up', 'ck-quiet-word'] },
]);

export const dailyFightFor = (date = new Date()) => {
  const key = localDateKey(date);
  const h = hashKey(key);
  const modifier = MODIFIERS[h % MODIFIERS.length];
  const crew = CREWS[(h >>> 8) % CREWS.length];
  return { key, modifier, crew };
};

export const resolveCrew = (crew, cards) =>
  crew.cards.map((id) => cards.find((card) => card.id === id)).filter(Boolean);

/** True when this turn owes a fatigue tick: the deck is empty, or the night's clock has started. One tick, not both. */
export const shouldFatigue = ({ deckEmpty, turn, fatigueFromTurn }) =>
  deckEmpty || (Number.isFinite(fatigueFromTurn) && turn >= fatigueFromTurn);

/**
 * The save patch for one sitting, or null when tonight is already on the books.
 * A win continues the streak only when yesterday was also a win. A missed day
 * starts it over. A loss zeroes it.
 */
export const nextDailyRecord = (state, won, key) => {
  if (!key || (state?.dailyKey === key && state?.dailyResult)) return null;
  const continued = won && state?.dailyResult === 'win' && state?.dailyKey === previousLocalDate(key);
  const streak = won ? (continued ? (state.dailyStreak || 0) + 1 : 1) : 0;
  return {
    dailyKey: key,
    dailyResult: won ? 'win' : 'loss',
    dailyStreak: streak,
    dailyBest: Math.max(state?.dailyBest || 0, streak),
  };
};
