import { Howl } from 'howler';

// Battle sound effects, hotlinked from the mixkit CDN.
export const SOUND_SPECS = {
  cardPlay: { src: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', volume: 0.3 },
  attack: { src: 'https://assets.mixkit.co/active_storage/sfx/2803/2803-preview.mp3', volume: 0.4 },
  damage: { src: 'https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3', volume: 0.3 },
  heal: { src: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', volume: 0.3 },
  victory: { src: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', volume: 0.5 },
  defeat: { src: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', volume: 0.4 },
  draw: { src: 'https://assets.mixkit.co/active_storage/sfx/2073/2073-preview.mp3', volume: 0.2 },
  trap: { src: 'https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3', volume: 0.4 },
};

// Howl instances, built on demand and reused thereafter.
const cache = new Map();

// Howler preloads on construction, so building all eight of these at module
// scope fired eight cross-origin CDN downloads the moment the battle chunk
// loaded — including for players who had sound switched off in Settings, who
// would never hear any of them. Constructing on first play defers that cost to
// someone who will actually hear the sound, and skips it entirely when sound
// is off. It also stops the eight simultaneous loads from exhausting Howler's
// HTML5 audio pool (default size 10) on platforms without Web Audio, which
// logs "HTML5 Audio pool exhausted" and hands back a potentially locked
// audio object.
export function getSound(name) {
  const spec = SOUND_SPECS[name];
  if (!spec) return null;
  if (!cache.has(name)) {
    cache.set(name, new Howl({ src: [spec.src], volume: spec.volume }));
  }
  return cache.get(name);
}

// Plays `name` if the player has sound enabled. Returns whether it played, so
// callers (and tests) can tell "muted" apart from "unknown sound".
export function playSound(name, enabled) {
  if (!enabled) return false;
  const sound = getSound(name);
  if (!sound) return false;
  sound.play();
  return true;
}
