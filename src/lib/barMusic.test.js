import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { NIGHT_BPM, NIGHT_SCORE, midiToHz, BarLoop } from './barMusic';

describe('the house band', () => {
  it('is a low, slow loop a bar can actually play', () => {
    expect(NIGHT_BPM).toBeGreaterThanOrEqual(60);
    expect(NIGHT_BPM).toBeLessThanOrEqual(100);
    expect(NIGHT_SCORE.length).toBeGreaterThanOrEqual(4);
    let beats = 0;
    for (const note of NIGHT_SCORE) {
      expect(note.beats).toBeGreaterThan(0);
      expect(note.midi).toBeGreaterThanOrEqual(36);
      expect(note.midi).toBeLessThanOrEqual(64);
      const hz = midiToHz(note.midi);
      expect(hz).toBeGreaterThan(60);
      expect(hz).toBeLessThan(400);
      beats += note.beats;
    }
    expect(beats).toBe(8);
  });

  it('does not pull Howler into the menu', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/barMusic.js'), 'utf8');
    expect(src).not.toMatch(/howler/);
  });

  it('stays quiet until asked, and stops cleanly without an audio device', () => {
    const loop = new BarLoop(null);
    expect(loop.ensure()).toBe(false);
    loop.setVolume(0.5);
    expect(loop.timer).toBeNull();
    loop.stop();
  });
});
