// Seasons the client knows how to play. The window and the status come from
// the server (card_seasons / open_card_pack). This list is which card ids
// are seasonal at all, so a missing answer keeps them out of packs instead
// of letting the laptop clock decide.

import { NAUGHTY_LIST_SEASON } from './naughtyList';

export const BUNDLED_SEASONS = Object.freeze([NAUGHTY_LIST_SEASON]);

export const BUNDLED_SEASON_IDS = new Set(BUNDLED_SEASONS.flatMap((season) => season.card_ids));

export const bundledSeason = (id) => BUNDLED_SEASONS.find((season) => season.id === id) || null;

/**
 * The catalog the collection book scores. A bundled seasonal card never
 * fills, or blocks, an evergreen rarity set. The season can be upcoming,
 * open, or over; the set is the same list.
 */
export const evergreenCards = (cards) => (cards || []).filter((card) => !BUNDLED_SEASON_IDS.has(card.id));
