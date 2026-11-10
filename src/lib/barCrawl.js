// One crawl a week, four stops, in order. Damage dealt before the first fight
// does not skip the door. The counters themselves reset with the week.

export const CRAWL_UNLOCK_BATTLES = 3;

export const CRAWL_REWARD = Object.freeze({ coins: 250, packs: 1 });

export const CRAWL_STOPS = Object.freeze([
  { id: 'door', name: 'Out the door', line: 'Finish one fight this week.', met: (s) => (s.weekBattles || 0) >= 1 },
  { id: 'loss', name: 'Someone loses', line: 'Win one this week.', met: (s) => (s.weekWins || 0) >= 1 },
  { id: 'mess', name: 'Make a mess', line: 'Deal 40 damage this week.', met: (s) => (s.weekDamage || 0) >= 40 },
  { id: 'song', name: 'Stay for the song', line: 'Play 8 cards this week.', met: (s) => (s.weekCards || 0) >= 8 },
  { id: 'chuck', name: 'His round', line: 'Own one of his crew, or play 8 cards.', met: (s) => (s.weekCards || 0) >= 8 || (s.ownedCards || []).some((id) => String(id).startsWith('ck-')) },
].map((row) => Object.freeze(row)));

export const crawlStatus = (state = {}, weekKey = '') => {
  let open = true;
  const stops = CRAWL_STOPS.map((stop) => {
    const met = open && stop.met(state);
    if (!met) open = false;
    return { id: stop.id, name: stop.name, line: stop.line, met };
  });
  const done = stops.every((stop) => stop.met);
  const claimed = Boolean(weekKey) && state.crawlClaimedWeek === weekKey;
  return { stops, done, claimed, reward: CRAWL_REWARD, unlocked: (state.totalBattles || 0) >= CRAWL_UNLOCK_BATTLES };
};
