// Limited nights at the bar. One fight, if you say you are in, and only while
// the night is actually on. The battle itself is unchanged until the player
// arms the event, so a clock that happens to be Thursday cannot rewrite the
// payout tests.

export const HOUSE_EVENTS = Object.freeze([
  {
    id: 'stag_do',
    name: 'Stag Do',
    blurb: 'His last night of freedom. One fight pays half again.',
    xp: 3,
    xpDen: 2,
    coins: 3,
    coinsDen: 2,
    live: (date) => date.getDay() === 6,
  },
  {
    id: 'ladies_night',
    name: 'Ladies’ Night',
    blurb: 'The room is theirs. One fight pays double coins.',
    xp: 1,
    xpDen: 1,
    coins: 2,
    coinsDen: 1,
    live: (date) => date.getDay() === 4,
  },
  {
    id: 'happy_hour',
    name: 'Happy Hour',
    blurb: 'Five till eight. One fight pays double XP.',
    xp: 2,
    xpDen: 1,
    coins: 1,
    coinsDen: 1,
    live: (date) => {
      const hour = date.getHours();
      return hour >= 17 && hour < 20;
    },
  },
].map((row) => Object.freeze(row)));

const IDS = new Set(HOUSE_EVENTS.map((event) => event.id));

/** The night that is on, special days ahead of happy hour. */
export const eventAt = (date = new Date()) => HOUSE_EVENTS.find((event) => event.live(date)) || null;

export const isEventId = (id) => IDS.has(id);

/** Integer scale. Half-again of 30 is 45, never 45.0001. */
export const scaleReward = (amount, num, den) => {
  const base = Math.max(0, Math.floor(Number(amount) || 0));
  const n = Math.max(0, Math.floor(Number(num) || 0));
  const d = Math.max(1, Math.floor(Number(den) || 1));
  return Math.floor((base * n) / d);
};

export const eventSpentKey = (date, id) => `${date.toDateString()}|${id}`;
