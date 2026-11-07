import { describe, it, expect } from 'vitest';
import { clampVolume, effectiveMusicVolume, effectiveSfxVolume } from './audioMix';

describe('audio mix', () => {
  it('clamps a fader into 0..1 and replaces junk with the fallback', () => {
    expect(clampVolume(0.4)).toBe(0.4);
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume('loud', 0.5)).toBe(0.5);
    expect(clampVolume(Number.NaN, 0.2)).toBe(0.2);
  });

  it('mutes sound effects when the switch is off, mute is on, or the fader is zero', () => {
    expect(effectiveSfxVolume({ soundEnabled: true, sfxVolume: 0.5 })).toBe(0.5);
    expect(effectiveSfxVolume({ soundEnabled: false, sfxVolume: 1 })).toBe(0);
    expect(effectiveSfxVolume({ soundEnabled: true, audioMuted: true, sfxVolume: 1 })).toBe(0);
    expect(effectiveSfxVolume({ soundEnabled: true, sfxVolume: 0 })).toBe(0);
  });

  it('plays music only when it is on, unmuted, and the fader is up', () => {
    expect(effectiveMusicVolume({ musicOn: true, musicVolume: 0.7 })).toBe(0.7);
    expect(effectiveMusicVolume({ musicOn: false, musicVolume: 1 })).toBe(0);
    expect(effectiveMusicVolume({ musicOn: true, audioMuted: true, musicVolume: 1 })).toBe(0);
    expect(effectiveMusicVolume({})).toBe(0);
  });
});
