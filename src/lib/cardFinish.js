// Gleam, wet-look, and the profile ring, decided from the catalog rather than
// from a list of card ids. A card added later — Hen Do, Morning After, Last
// Orders, or a set that is not in the game yet — gets the same finish as every
// other card of its rarity, because nothing here reads an id.

import { RARITY_ORDER } from './rarity';
import { WARDROBE } from './wardrobe';

const at = (rarity) => RARITY_ORDER.indexOf(rarity);
const GLEAM_FROM = at('rare');
const EPIC_FROM = at('epic');
const LEGENDARY_FROM = at('legendary');

// Finishes that paint the moving sheen. Matte is the absence of one.
export const HOLO_FINISHES = Object.freeze(['wet-look']);

/** 'rare' | 'epic' | 'legendary' for a tier at or above rare, otherwise null.
 *  A rarity inserted into RARITY_ORDER at or after rare gleams without a new
 *  branch here. Tiers below rare stay matte. */
export const gleamFor = (rarity) => {
  const index = at(rarity);
  if (index < GLEAM_FROM) return null;
  if (index >= LEGENDARY_FROM) return 'legendary';
  if (index >= EPIC_FROM) return 'epic';
  return 'rare';
};

export const wearsHolo = (finish) => HOLO_FINISHES.includes(finish);

const avatarIds = () => WARDROBE.filter((item) => item.slot === 'avatar').map((item) => item.id);

/** The equipped profile ring, or the wardrobe's first ring when the id is unknown. */
export const ringId = (id) => {
  const rings = avatarIds();
  return rings.includes(id) ? id : rings[0];
};
