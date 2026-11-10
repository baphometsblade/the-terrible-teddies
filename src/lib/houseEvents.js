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
    id: 'last_orders',
    name: 'Last Orders',
    blurb: 'Tuesday belongs to Chuck. One fight pays half again.',
    xp: 3,
    xpDen: 2,
    coins: 3,
    coinsDen: 2,
    live: (date) => date.getDay() === 2,
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

// The office party, while the server says The Naughty List is active.
// Same shape as the other nights: one fight, half again, not a better pack.
export const CHRISTMAS_PARTY = Object.freeze({
  id: 'naughty_list',
  name: 'Naughty List Night',
  blurb: 'The office party took the back room. One fight pays half again.',
  xp: 3,
  xpDen: 2,
  coins: 3,
  coinsDen: 2,
});

const IDS = new Set([...HOUSE_EVENTS.map((event) => event.id), CHRISTMAS_PARTY.id]);

/**
 * The night that is on. A season the server marked active beats the weekly
 * calendar. The date still picks stag night and happy hour when no season
 * is up. Pass the snapshot's seasons; do not invent one from the clock.
 */
export const eventAt = (date = new Date(), seasons = []) => {
  const party = (seasons || []).find((season) => season.status === 'active' && season.theme === 'christmas-party');
  if (party) return CHRISTMAS_PARTY;
  return HOUSE_EVENTS.find((event) => event.live(date)) || null;
};

/** What the back room shows, including a preview that does not pay. */
export const displayEvent = (date = new Date(), seasons = []) => {
  const party = (seasons || []).find((season) => (
    (season.status === 'active' || season.status === 'preview') && season.theme === 'christmas-party'
  ));
  if (party) return { ...CHRISTMAS_PARTY, preview: party.status === 'preview' };
  return eventAt(date, seasons);
};

export const isEventId = (id) => IDS.has(id);

/** Integer scale. Half-again of 30 is 45, never 45.0001. */
export const scaleReward = (amount, num, den) => {
  const base = Math.max(0, Math.floor(Number(amount) || 0));
  const n = Math.max(0, Math.floor(Number(num) || 0));
  const d = Math.max(1, Math.floor(Number(den) || 1));
  return Math.floor((base * n) / d);
};

export const eventSpentKey = (date, id) => `${date.toDateString()}|${id}`;
