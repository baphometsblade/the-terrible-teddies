// Plaques on the wall. Reaching the level lets you nail one up, once.
// Each one the player wears adds a little to every daily claim after that.

export const PLAQUE_DAILY_COINS = 10;

export const PLAQUES = Object.freeze([
  { id: 'plaque_10', level: 10, name: 'Third Date', line: 'You came back. The room noticed.', coins: 200 },
  { id: 'plaque_25', level: 25, name: 'Regular Problem', line: 'They stopped asking if you are lost.', coins: 500 },
  { id: 'plaque_50', level: 50, name: 'House Rules', line: 'A rule has your name. In lipstick.', coins: 1000 },
].map((row) => Object.freeze(row)));

export const plaqueById = (id) => PLAQUES.find((plaque) => plaque.id === id) || null;

export const plaqueBonus = (ids) => (Array.isArray(ids) ? ids.filter((id) => plaqueById(id)).length : 0) * PLAQUE_DAILY_COINS;
