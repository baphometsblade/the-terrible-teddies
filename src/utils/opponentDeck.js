// Builds Chuck's opponent deck for a battle. Extracted from GameBoard.jsx so
// the deck varies fight-to-fight instead of being the same hardcoded 8 goons
// forever — and so the composition logic is pure and unit-testable.
import { ALL_CARDS } from '@/stores/gameStore';

// Chuck's 8 named regulars — the recognisable core of his crew. Ids/stats/
// abilities are moved here verbatim from the array GameBoard.jsx used to
// hardcode; these are the pre-difficulty-modifier baselines (see
// DIFFICULTY_CONFIG below for the attack/defense deltas applied on top).
export const OPPONENT_GOONS = [
  { id: 101, name: "Repo Ted", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common' },
  { id: 102, name: "Loan-Shark Larry", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt', rarity: 'common' },
  { id: 103, name: "Off-the-Grid Greg", attack: 4, defense: 2, type: 'action', cost: 3, ability: 'piercing', rarity: 'rare' },
  { id: 104, name: "Unhinged Cuddles", attack: 3, defense: 3, type: 'action', cost: 3, ability: 'fury', rarity: 'epic' },
  { id: 105, name: "Whiskey Whiskers", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common' },
  { id: 106, name: "Landlord Lucifur", attack: 4, defense: 4, type: 'action', cost: 4, ability: 'shield', rarity: 'legendary' },
  { id: 107, name: "Custody-Battle Cub", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'stealth', rarity: 'rare' },
  { id: 108, name: "Void Where Prohibited", attack: 5, defense: 3, type: 'action', cost: 4, ability: 'piercing', rarity: 'epic' },
].map((card) => Object.freeze({ ...card }));

const DECK_SIZE = 8;

// Difficulty shapes the DRAW, not just the stat mods:
//  - goonCount: how many of Chuck's 8 named regulars make the cut. Easy leans
//    on the (weaker, familiar) regulars; hard thins them out in favor of the
//    catalog's scarier rarities.
//  - rarities: the rarity band the catalog fill is drawn from.
//  - attackMod/defenseMod/healthMod: the original per-difficulty stat deltas,
//    unchanged from GameBoard.jsx's old `opponentBaseStats`.
const DIFFICULTY_CONFIG = {
  easy: { goonCount: 5, rarities: ['common', 'uncommon'], attackMod: -1, defenseMod: -1, healthMod: -5 },
  normal: { goonCount: 4, rarities: ['common', 'uncommon', 'rare'], attackMod: 0, defenseMod: 0, healthMod: 0 },
  hard: { goonCount: 2, rarities: ['rare', 'epic', 'legendary'], attackMod: 1, defenseMod: 1, healthMod: 5 },
};

// Re-exported so GameBoard.jsx can keep `setOpponentHealth(30 + healthMod)`
// exactly as before, sourced from the same single table instead of a
// duplicate copy of the magic numbers.
export const OPPONENT_HEALTH_MOD_BY_DIFFICULTY = Object.fromEntries(
  Object.entries(DIFFICULTY_CONFIG).map(([k, v]) => [k, v.healthMod])
);

// Flavour names for the crew Chuck brings this fight — shown to the player so
// each battle reads as a distinct lineup, not just "the opponent" again.
const CREW_NAMES = [
  "the Last-Call Crew",
  "the Dumpster Cartel",
  "the Repo Regulars",
  "the Alley Syndicate",
  "the Tab-Skippers",
  "the Bail-Jump Bunch",
  "the Barfly Mafia",
  "the Closing-Time Gang",
  "the Sunday Scaries",
  "the Drunk-Uncle Militia",
];

// Fisher-Yates using an injectable rng so callers can seed determinism.
const shuffle = (arr, rng) => {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const sample = (pool, n, rng) => shuffle(pool, rng).slice(0, Math.max(0, n));

/**
 * Build one battle's opponent deck. Pure and seedable — pass `rng` (a
 * `() => number` in [0,1)) for deterministic tests; defaults to `Math.random`
 * for real play. Never imports React or touches app state.
 *
 * Deck = `goonCount` of Chuck's 8 named regulars (random subset) + the rest
 * drawn from the catalog (`ALL_CARDS`, `type === 'action'`, filtered to the
 * difficulty's rarity band) = 8 cards total. Catalog cards are reused as-is —
 * their art already exists — just copied (never mutating ALL_CARDS) and
 * stamped with a unique `instanceId`, the same convention GameBoard already
 * uses for the player's deck (`o-<id>-<idx>`).
 *
 * Difficulty modifier scope: the attack/defense deltas are applied to EVERY
 * card in the deck, catalog cards included, not just the goons. This is a
 * deliberate choice: if only the goons were modified, a "hard" fight that
 * happens to draw mostly catalog rares would field weaker stats than an
 * "easy" fight's boosted goons, making the difficulty setting feel inverted
 * on a bad roll. Applying the delta uniformly keeps the promise "hard hits
 * harder" true regardless of which pool contributed a given card.
 *
 * Edge-case guards: if a rarity band is too thin to fill the catalog quota,
 * the catalog filter widens to every action card. If the deck is still short
 * of 8 (only possible if the catalog were smaller than the shortfall, which
 * it never is today), extra goons (repeats allowed) top it up so callers can
 * always rely on exactly 8 cards. `instanceId`s stay unique in every case
 * because they're stamped by array position, not by card id.
 *
 * @param {'easy'|'normal'|'hard'} difficulty
 * @param {() => number} [rng] injectable RNG in [0,1), defaults to Math.random
 * @returns {{ cards: object[], crewName: string }}
 */
export const buildOpponentDeck = (difficulty, rng = Math.random) => {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal;
  const { goonCount, rarities, attackMod, defenseMod } = config;

  const goonPool = sample(OPPONENT_GOONS, Math.min(goonCount, OPPONENT_GOONS.length), rng);

  let catalogPool = ALL_CARDS.filter((c) => c.type === 'action' && rarities.includes(c.rarity));
  const neededCatalog = DECK_SIZE - goonPool.length;
  if (catalogPool.length < neededCatalog) {
    // Rarity band too thin to fill the quota — widen to every action card
    // rather than under-filling the deck.
    catalogPool = ALL_CARDS.filter((c) => c.type === 'action');
  }
  const catalogCards = sample(catalogPool, Math.min(neededCatalog, catalogPool.length), rng);

  const combined = [...goonPool, ...catalogCards];
  // Extremely defensive top-up: only reachable if the catalog itself were
  // smaller than the deck size, which it isn't (41 action cards today).
  let guard = 0;
  while (combined.length < DECK_SIZE && guard < DECK_SIZE * 4) {
    combined.push(OPPONENT_GOONS[Math.floor(rng() * OPPONENT_GOONS.length)]);
    guard += 1;
  }

  // Stamp mods + instanceId (by position, before the final shuffle) so
  // instanceIds stay unique even if a repeat goon was pushed by the guard
  // above. Copies every card — ALL_CARDS and OPPONENT_GOONS are never mutated.
  const withModsAndInstance = combined.map((card, idx) => ({
    ...card,
    attack: card.attack + attackMod,
    defense: card.defense + defenseMod,
    instanceId: `o-${card.id}-${idx}`,
  }));

  const cards = shuffle(withModsAndInstance, rng);
  const crewName = CREW_NAMES[Math.floor(rng() * CREW_NAMES.length)];

  return { cards, crewName };
};
