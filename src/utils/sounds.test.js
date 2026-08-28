import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every test needs a module registry with an empty sound cache, so the module
// is re-imported per test rather than shared across them.
const howlCtor = vi.fn();
const play = vi.fn();

vi.mock('howler', () => ({
  Howl: class {
    constructor(opts) {
      howlCtor(opts);
      this.play = play;
    }
  },
}));

async function freshModule() {
  vi.resetModules();
  return import('./sounds.js');
}

beforeEach(() => {
  howlCtor.mockClear();
  play.mockClear();
});

describe('sound effects', () => {
  // The regression this guards: the Howls used to be built at module scope,
  // and Howler preloads on construction — so merely loading the battle chunk
  // fetched eight cross-origin audio files before anything had been played,
  // and did it even for players with sound switched off.
  it('constructs no Howl until a sound is actually played', async () => {
    const { SOUND_SPECS } = await freshModule();
    expect(Object.keys(SOUND_SPECS).length).toBeGreaterThan(0);
    expect(howlCtor).not.toHaveBeenCalled();
  });

  it('constructs nothing and plays nothing when sound is disabled', async () => {
    const { playSound } = await freshModule();
    expect(playSound('attack', false)).toBe(false);
    expect(howlCtor).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('builds only the requested sound on first play, not the whole set', async () => {
    const { playSound, SOUND_SPECS } = await freshModule();
    expect(playSound('attack', true)).toBe(true);
    expect(howlCtor).toHaveBeenCalledTimes(1);
    expect(howlCtor).toHaveBeenCalledWith({
      src: [SOUND_SPECS.attack.src],
      volume: SOUND_SPECS.attack.volume,
      onloaderror: expect.any(Function),
    });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached Howl on repeat plays instead of refetching', async () => {
    const { playSound } = await freshModule();
    playSound('attack', true);
    playSound('attack', true);
    playSound('attack', true);
    expect(howlCtor).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(3);
  });

  it('returns false for an unknown sound name rather than throwing', async () => {
    const { playSound } = await freshModule();
    expect(playSound('no-such-sound', true)).toBe(false);
    expect(howlCtor).not.toHaveBeenCalled();
  });

  it('every spec has a usable src and a volume between 0 and 1', async () => {
    const { SOUND_SPECS } = await freshModule();
    for (const [name, spec] of Object.entries(SOUND_SPECS)) {
      expect(typeof spec.src, `${name} needs a string src`).toBe('string');
      expect(spec.volume, `${name} volume out of range`).toBeGreaterThan(0);
      expect(spec.volume, `${name} volume out of range`).toBeLessThanOrEqual(1);
    }
  });

  it('serves every clip from our own origin, never a hotlink', async () => {
    // The regression this exists to prevent, which actually shipped: the specs
    // hotlinked assets.mixkit.co, and three of those URLs later started
    // returning 403 AccessDenied. Four of the eight sounds went silent and
    // nothing noticed, because a Howl that fails to load just makes no noise.
    // Same-origin files under public/sounds/ cannot rot that way.
    const { SOUND_SPECS } = await freshModule();
    for (const [name, spec] of Object.entries(SOUND_SPECS)) {
      expect(
        /^https?:\/\//i.test(spec.src),
        `${name} points at an external URL (${spec.src}). Put the clip in ` +
          `public/sounds/ and reference it as /sounds/<file> — hotlinked audio ` +
          `has already silently died once.`
      ).toBe(false);
      expect(spec.src.startsWith('/sounds/'), `${name} should live under /sounds/`).toBe(true);
    }
  });

  it('evicts a Howl that fails to load, so its play queue cannot grow forever', async () => {
    // Howler queues every play() against an instance that is still loading. If
    // the load never succeeds the queue never drains — one entry per attempted
    // sound, for the whole session. Dropping the instance on error takes the
    // queue with it and lets the next play start clean.
    const { playSound } = await freshModule();
    playSound('attack', true);
    expect(howlCtor).toHaveBeenCalledTimes(1);

    // Fire the handler the module registered.
    const { onloaderror } = howlCtor.mock.calls[0][0];
    onloaderror();

    // Next play must build a fresh Howl rather than reuse the dead one.
    playSound('attack', true);
    expect(howlCtor).toHaveBeenCalledTimes(2);
  });
});
