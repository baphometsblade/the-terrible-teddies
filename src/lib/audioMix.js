// How loud the bar is. Pure, so Settings, the battle's sound effects and the
// music loop all agree, and a mute wins over either fader.

const clamp01 = (n, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
};

/** A fader position, 0 through 1. Anything else is the fallback. */
export const clampVolume = (n, fallback = 1) => clamp01(n, fallback);

/**
 * The gain battle sound effects actually play at.
 * `soundEnabled` is the existing Sound Effects switch. Mute and a fader at
 * zero are silence, and silence does not construct a sound.
 */
export const effectiveSfxVolume = ({ soundEnabled = true, audioMuted = false, sfxVolume = 1 } = {}) => {
  if (!soundEnabled || audioMuted) return 0;
  return clamp01(sfxVolume, 1);
};

/** The gain the music loop plays at. Off, muted, or a fader at zero is silence. */
export const effectiveMusicVolume = ({ musicOn = false, audioMuted = false, musicVolume = 0 } = {}) => {
  if (!musicOn || audioMuted) return 0;
  return clamp01(musicVolume, 0);
};
