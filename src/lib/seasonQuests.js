// The Naughty List's quest line. Three steps, in order, paid in coins and
// one ordinary pack. The pack uses the same opener as every other pack.

export const SEASON_QUESTS = Object.freeze([
  {
    id: 'nl-stay',
    seasonId: 'naughty-list',
    name: 'Stay for the speech',
    line: 'Win 1 battle while the party is on.',
    stat: 'wins',
    target: 1,
    reward: Object.freeze({ coins: 80, packs: 0 }),
  },
  {
    id: 'nl-cards',
    seasonId: 'naughty-list',
    name: 'Eight bad decisions',
    line: 'Play 8 cards in battles while the party is on.',
    stat: 'cards',
    target: 8,
    reward: Object.freeze({ coins: 120, packs: 0 }),
  },
  {
    id: 'nl-pack',
    seasonId: 'naughty-list',
    name: 'Open the present',
    line: 'Open 1 pack while the party is on.',
    stat: 'packs',
    target: 1,
    reward: Object.freeze({ coins: 0, packs: 1 }),
  },
].map((row) => Object.freeze(row)));

const empty = (seasonId) => ({ seasonId, wins: 0, cards: 0, packs: 0, claimed: [] });

const count = (value) => {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 9999);
};

export const normalizeSeasonQuest = (raw) => {
  if (!raw || typeof raw !== 'object') return empty('');
  const claimed = Array.isArray(raw.claimed)
    ? raw.claimed.filter((id) => typeof id === 'string').slice(0, 12)
    : [];
  return {
    seasonId: typeof raw.seasonId === 'string' ? raw.seasonId : '',
    wins: count(raw.wins),
    cards: count(raw.cards),
    packs: count(raw.packs),
    claimed,
  };
};

/** Progress only moves while the server says the season is active. */
export const bumpSeasonQuest = (current, season, patch = {}) => {
  if (!season || season.status !== 'active') return normalizeSeasonQuest(current);
  const base = current?.seasonId === season.id ? normalizeSeasonQuest(current) : empty(season.id);
  return {
    ...base,
    wins: count(base.wins + (patch.wins || 0)),
    cards: count(base.cards + (patch.cards || 0)),
    packs: count(base.packs + (patch.packs || 0)),
  };
};

export const questState = (current, season) => {
  const saved = normalizeSeasonQuest(current);
  return saved.seasonId === season?.id ? saved : empty(season?.id || '');
};

export const questReady = (quest, progress) => (
  !progress.claimed.includes(quest.id) && (progress[quest.stat] || 0) >= quest.target
);

export const questsFor = (seasonId) => SEASON_QUESTS.filter((quest) => quest.seasonId === seasonId);
