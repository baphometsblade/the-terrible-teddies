// The house band: a short loop of low triangle notes, no sample to download
// and nothing for Howler to fetch. The score is data so a test can check the
// range without an audio device. Playback waits for a volume above zero and
// for a user gesture to resume the context (iOS will not start it otherwise).

export const NIGHT_BPM = 72;

// One bar, then it repeats. MIDI numbers, low on purpose: a bar, not an alarm.
export const NIGHT_SCORE = Object.freeze([
  { midi: 45, beats: 2 },
  { midi: 52, beats: 1 },
  { midi: 48, beats: 1 },
  { midi: 43, beats: 2 },
  { midi: 50, beats: 1 },
  { midi: 47, beats: 1 },
]);

export const midiToHz = (midi) => 440 * (2 ** ((midi - 69) / 12));

/** How loud the room hiss sits under the band. Silent when the band is. */
export const roomToneGain = (musicVolume) => (
  musicVolume > 0 ? Math.min(0.035, musicVolume * 0.04) : 0
);

const beatMs = (beats) => beats * (60000 / NIGHT_BPM);

export class BarLoop {
  constructor(Ctx = globalThis.AudioContext || globalThis.webkitAudioContext) {
    this.Ctx = Ctx;
    this.ctx = null;
    this.gain = null;
    this.timer = null;
    this.step = 0;
    this.volume = 0;
    this.noise = null;
  }

  startRoom() {
    const level = roomToneGain(this.volume);
    if (!this.ctx || !(level > 0) || this.noise) return;
    if (typeof this.ctx.createBuffer !== 'function') return;
    const seconds = 1;
    const rate = this.ctx.sampleRate || 22050;
    const buffer = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.4;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter?.();
    const gain = this.ctx.createGain();
    gain.gain.value = level;
    if (filter) {
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(this.ctx.destination);
    source.start();
    this.noise = { source, gain };
  }

  /** Create the context if this browser has one, and resume it. Call from a gesture. */
  ensure() {
    if (!this.Ctx) return false;
    if (!this.ctx) {
      try {
        this.ctx = new this.Ctx();
      } catch {
        this.Ctx = null;
        return false;
      }
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.applyVolume();
    return true;
  }

  setVolume(volume) {
    this.volume = volume > 0 ? volume : 0;
    if (this.volume > 0) {
      this.ensure();
      if (!this.timer) this.schedule();
      this.startRoom();
      if (this.noise) this.noise.gain.gain.value = roomToneGain(this.volume);
    } else {
      this.pause();
      if (this.gain) this.gain.gain.value = 0;
      if (this.noise) this.noise.gain.gain.value = 0;
    }
  }

  applyVolume() {
    if (!this.gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.volume, now);
  }

  schedule() {
    const tick = () => {
      if (!(this.volume > 0) || !this.ctx) {
        this.timer = null;
        return;
      }
      const note = NIGHT_SCORE[this.step % NIGHT_SCORE.length];
      this.step += 1;
      this.blip(note.midi, beatMs(note.beats) / 1000);
      this.timer = setTimeout(tick, beatMs(note.beats));
    };
    tick();
  }

  blip(midi, seconds) {
    if (!this.ctx || !this.gain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const dur = Math.max(0.08, seconds);
    osc.type = 'triangle';
    osc.frequency.value = midiToHz(midi);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(env);
    env.connect(this.gain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  pause() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  stop() {
    this.pause();
    const ctx = this.ctx;
    this.ctx = null;
    this.gain = null;
    this.noise = null;
    if (ctx && typeof ctx.close === 'function') ctx.close();
  }
}
