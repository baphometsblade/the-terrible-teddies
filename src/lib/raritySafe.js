// Colourblind-safe rarity inks. The default palette leans on green, blue and
// purple, which collapse together for a lot of players. These five stay apart
// under a deuteranopia simulation (see raritySafe.test.js) and each clears
// 4.5:1 on the night panel (#1a1226). index.css paints them when
// html[data-cb="safe"] is set; the hexes here are the source those rules copy.

export const NIGHT_PANEL = '#1a1226';

export const SAFE_INK = Object.freeze({
  common: '#d6d3d1',
  uncommon: '#7dd3fc',
  rare: '#fdba74',
  epic: '#f9a8d4',
  legendary: '#fcd34d',
});

// One solid a gem, a dot or a sliver can fill. Lighter than the ink so a
// small mark still reads, and still not a red/green pair.
// Chosen so the closest pair still separates under the deuteranopia matrix
// in raritySafe.test.js. Common is the dark stone; the others are blue,
// orange, pink and yellow, which do not collapse into each other.
export const SAFE_MARK = Object.freeze({
  common: '#44403c',
  uncommon: '#0369a1',
  rare: '#c2410c',
  epic: '#f9a8d4',
  legendary: '#fde047',
});

export const SAFE_RARITIES = Object.freeze(Object.keys(SAFE_INK));
