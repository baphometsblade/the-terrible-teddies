// Which card of a rolled rarity comes out of a pack. Rarity odds stay
// PACK_ODDS, the same table for a pack bought with gems and a pack the
// house handed over. A live season only changes the weight inside that
// rarity. A season the server did not mark active is not in the pool.

import { BUNDLED_SEASON_IDS } from '@/data/seasonsCatalog';

export const weightedRows = (catalog, rarity, seasons, bundledIds = BUNDLED_SEASON_IDS) => {
  const active = new Map();
  const mentioned = new Set();
  for (const season of seasons || []) {
    const boost = Number(season.pack_weight_boost);
    const weight = Number.isFinite(boost) && boost > 0 ? boost : 1;
    for (const id of season.card_ids || []) {
      mentioned.add(id);
      if (season.status === 'active' || season.status === 'preview') active.set(id, weight);
    }
  }
  const rows = [];
  for (const card of catalog || []) {
    if (card.rarity !== rarity) continue;
    const seasonal = bundledIds.has(card.id) || mentioned.has(card.id);
    if (seasonal && !active.has(card.id)) continue;
    rows.push({ card, weight: active.get(card.id) || 1 });
  }
  return rows;
};

export const weightedPick = (rows, random = Math.random) => {
  if (!rows?.length) return null;
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) return rows[rows.length - 1].card;
  let roll = random() * total;
  for (const row of rows) {
    roll -= row.weight;
    if (roll < 0) return row.card;
  }
  return rows[rows.length - 1].card;
};

const RARITY_FALLBACK = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

/**
 * One pack. `rollRarity` and the odds tables are the store's, passed in so
 * this file does not import the store. `random` is the only source of luck.
 */
export const rollPack = ({
  catalog,
  seasons,
  packType,
  slots,
  odds,
  rollRarity,
  random = Math.random,
  bundledIds = BUNDLED_SEASON_IDS,
}) => {
  const spec = slots[packType] || slots.regular;
  const cards = [];
  for (let i = 0; i < spec.size; i += 1) {
    const table = odds[i === 0 ? spec.first : 'standard'];
    const rarity = rollRarity(table, random() * table.reduce((sum, [, weight]) => sum + weight, 0));
    const start = Math.max(0, RARITY_FALLBACK.indexOf(rarity));
    let picked = null;
    for (let j = start; j < RARITY_FALLBACK.length; j += 1) {
      const rows = weightedRows(catalog, RARITY_FALLBACK[j], seasons, bundledIds);
      if (rows.length) {
        picked = weightedPick(rows, random);
        break;
      }
    }
    if (picked) cards.push(picked);
  }
  return cards;
};
