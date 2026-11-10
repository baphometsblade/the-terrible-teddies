// What Chuck says while a pack is tearing open. The odds and the cards
// do not change. This is only the line over the table.

export const PACK_CEREMONY = Object.freeze([
  'Chuck leans in. He says he is not hoping. He is hoping.',
  'Open it slow. He likes to watch the good ones land.',
  'If it is a dud, blame the night. He already is.',
  'Hands off his until yours is face up. Those are the rules.',
  'If his own face turns up, he buys the round.',
]);

export const PACK_CEREMONY_MAX = 64;

export const packCeremonyLine = (random = Math.random) => {
  const i = Math.min(PACK_CEREMONY.length - 1, Math.floor(random() * PACK_CEREMONY.length));
  return PACK_CEREMONY[i];
};
