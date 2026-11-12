// Seeded mulberry32. The state is a uint32. The same state always yields the
// same next value, so a match replayed from its seed and its actions lands
// on the same board. No Math.random, anywhere in the combat module.

/** @returns {{ state: number, value: number }} value is in [0, 1). */
export function nextRandom(state) {
  let t = ((state >>> 0) + 0x6D2B79F5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { state: t >>> 0, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
}

/** FNV-1a over a string. Stable across runtimes for the same text. */
export function hashString(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
