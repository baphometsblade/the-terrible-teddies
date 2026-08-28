import { Howl } from 'howler';

// Battle sound effects, served from our own origin.
//
// They used to hotlink assets.mixkit.co directly. That silently rotted: three
// of the seven URLs now return 403 AccessDenied (verified with curl), killing
// four of the eight sounds — cardPlay, heal, victory and trap — with no error
// a player or a test would ever see, because a Howl that fails to load simply
// never makes a noise. Self-hosting removes the whole class of failure: these
// are now build assets under public/sounds/, same-origin, and covered by the
// CSP's media-src 'self'.
//
// Only four clips survived the CDN, so four events currently share a clip with
// a sibling. That is a deliberate interim: every event makes a sound again,
// which is strictly better than four of them being silent. Replacing the
// doubled-up ones with distinct clips is a content task, not a code one — drop
// new files in public/sounds/ and repoint the specs below.
export const SOUND_SPECS = {
  attack:   { src: '/sounds/attack.mp3', volume: 0.4 },
  damage:   { src: '/sounds/damage.mp3', volume: 0.3 },
  defeat:   { src: '/sounds/defeat.mp3', volume: 0.4 },
  draw:     { src: '/sounds/draw.mp3',   volume: 0.2 },
  // Shared until distinct replacements exist (see note above):
  cardPlay: { src: '/sounds/draw.mp3',   volume: 0.3 }, // soft UI blip
  heal:     { src: '/sounds/draw.mp3',   volume: 0.3 },
  victory:  { src: '/sounds/attack.mp3', volume: 0.5 }, // punchy, not the defeat sting
  trap:     { src: '/sounds/damage.mp3', volume: 0.4 },
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
    // onloaderror matters even now that the files are local: a Howl that can't
    // load keeps every play() request queued forever, one entry per call, so a
    // long session with an unreachable asset grows an unbounded queue that can
    // never drain. Evicting the instance drops the queue with it and lets a
    // later play retry from scratch instead of piling onto a dead object.
    const howl = new Howl({
      src: [spec.src],
      volume: spec.volume,
      onloaderror: () => {
        howl.unload?.();
        cache.delete(name);
      },
    });
    cache.set(name, howl);
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
