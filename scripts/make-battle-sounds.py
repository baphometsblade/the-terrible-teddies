#!/usr/bin/env python3
"""Distinct battle clips for the four events that used to borrow a sibling.

The original four (attack, damage, defeat, draw) are short, dry, 44.1 kHz
mp3s peaked around -6 dB. These match that pocket. Each gesture is its own:

  card-play  two soft felt taps            ~0.28s   (draw is one flick)
  heal       a warm pour, a rising fifth   ~0.62s
  victory    a short brass major sting     ~0.95s   (defeat is the long one)
  trap       a snap, then a falling spring ~0.42s   (damage is a heavier thud)

Deterministic: no random seed the ear can hear, so a re-run writes the same
files. Requires ffmpeg (libmp3lame) on PATH.
"""
import math
import shutil
import struct
import subprocess
import sys
from pathlib import Path

SR = 44100
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'sounds'


def lowpass(samples, cutoff):
    a = 1 - math.exp(-2 * math.pi * cutoff / SR)
    y = 0.0
    out = []
    for x in samples:
        y += a * (x - y)
        out.append(y)
    return out


def highpass(samples, cutoff):
    # y[n] = a * (y[n-1] + x[n] - x[n-1])
    rc = 1 / (2 * math.pi * cutoff)
    dt = 1 / SR
    a = rc / (rc + dt)
    y = 0.0
    prev = 0.0
    out = []
    for x in samples:
        y = a * (y + x - prev)
        prev = x
        out.append(y)
    return out


def noise(n, seed):
    # xorshift, deterministic, centred on 0.
    x = seed & 0xFFFFFFFF or 1
    out = []
    for _ in range(n):
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= (x >> 17) & 0xFFFFFFFF
        x ^= (x << 5) & 0xFFFFFFFF
        out.append(((x & 0xFFFF) / 32768.0) - 1)
    return out


def env_exp(n, decay):
    return [math.exp(-i / (SR * decay)) for i in range(n)]


def tone(freq, n, decay, harmonics):
    out = [0.0] * n
    for k, amp in harmonics:
        phase = 0.0
        step = 2 * math.pi * freq * k / SR
        for i in range(n):
            out[i] += math.sin(phase) * amp * math.exp(-i / (SR * decay * (1 + 0.15 * (k - 1))))
            phase += step
    return out


def chirp(f0, f1, n, decay):
    out = []
    phase = 0.0
    for i in range(n):
        t = i / (n - 1) if n > 1 else 0
        freq = f0 * ((f1 / f0) ** t)
        phase += 2 * math.pi * freq / SR
        out.append(math.sin(phase) * math.exp(-i / (SR * decay)))
    return out


def place(bed, clip, at):
    start = int(at * SR)
    for i, s in enumerate(clip):
        j = start + i
        if j < len(bed):
            bed[j] += s
    return bed


def silence(seconds):
    return [0.0] * int(SR * seconds)


def fade(samples, fade_in=0.004, fade_out=0.02):
    n_in = int(SR * fade_in)
    n_out = int(SR * fade_out)
    out = samples[:]
    for i in range(min(n_in, len(out))):
        out[i] *= i / n_in
    for i in range(min(n_out, len(out))):
        out[-1 - i] *= i / n_out
    return out


def saturate(samples, drive):
    return [math.tanh(s * drive) for s in samples]


def normalize(samples, peak_db):
    peak = max(abs(s) for s in samples) or 1
    gain = (10 ** (peak_db / 20)) / peak
    return [max(-1.0, min(1.0, s * gain)) for s in samples]


def card_play():
    bed = silence(0.28)
    for at, freq, amp in ((0.0, 118, 0.9), (0.09, 156, 0.55)):
        n = int(SR * 0.12)
        thump = [s * amp for s in tone(freq, n, 0.045, [(1, 1), (2, 0.25)])]
        burst = lowpass(noise(int(SR * 0.03), 0xC0FFEE + int(freq)), 900)
        burst = [s * e * 0.55 * amp for s, e in zip(burst, env_exp(len(burst), 0.012))]
        place(bed, thump, at)
        place(bed, burst, at)
    return fade(bed, 0.001, 0.03)


def heal():
    bed = silence(0.62)
    # A little liquid, well under the two notes. F4, then C5 a fifth up.
    pour = highpass(lowpass(noise(len(bed), 0xA11CE), 900), 420)
    pour = [s * (1 - math.exp(-i / (SR * 0.05))) * math.exp(-i / (SR * 0.22)) * 0.05 for i, s in enumerate(pour)]
    place(bed, pour, 0)
    for at, freq, amp in ((0.0, 349.23, 0.9), (0.18, 523.25, 1.0)):
        n = int(SR * 0.5)
        body = tone(freq, n, 0.34, [(1, 1), (2, 0.4), (3, 0.12)])
        body = [s * amp * (1 - math.exp(-i / (SR * 0.045))) for i, s in enumerate(body)]
        place(bed, body, at)
    return fade(bed, 0.01, 0.06)


def victory():
    bed = silence(0.95)
    notes = ((0.0, 392.00), (0.12, 493.88), (0.24, 587.33))  # G4 B4 D5, a G major sting
    for at, freq in notes:
        n = int(SR * 0.55)
        body = tone(freq, n, 0.22, [(1, 1), (2, 0.55), (3, 0.28), (4, 0.08)])
        chiff_n = int(SR * 0.02)
        chiff = highpass(noise(chiff_n, int(freq * 10) or 1), 1200)
        chiff = [s * e * 0.35 for s, e in zip(chiff, env_exp(chiff_n, 0.008))]
        place(bed, saturate(body, 1.4), at)
        place(bed, chiff, at)
    # The last note stays up a little longer so it reads as a sting, not a tap.
    hold = tone(587.33, int(SR * 0.7), 0.34, [(1, 0.45), (2, 0.2)])
    place(bed, hold, 0.24)
    return fade(saturate(bed, 1.15), 0.003, 0.06)


def trap():
    bed = silence(0.42)
    click_n = int(SR * 0.012)
    click = highpass(noise(click_n, 0x7A9), 1500)
    click = [s * e for s, e in zip(click, env_exp(click_n, 0.004))]
    place(bed, click, 0)
    spring = chirp(1680, 150, int(SR * 0.38), 0.11)
    partial = chirp(1680 * 2.41, 150 * 2.41, int(SR * 0.22), 0.07)
    partial = [s * 0.28 for s in partial]
    place(bed, spring, 0.008)
    place(bed, partial, 0.008)
    return fade(bed, 0.001, 0.025)


CLIPS = {
    'card-play.mp3': (card_play, -7.5),
    'heal.mp3': (heal, -8.0),
    'victory.mp3': (victory, -5.5),
    'trap.mp3': (trap, -6.0),
}


def encode(path, samples):
    if shutil.which('ffmpeg') is None:
        sys.exit('ffmpeg is required (libmp3lame)')
    # A few silent frames so the encoder's padding does not land on a transient.
    samples = samples + [0.0] * int(SR * 0.03)
    raw = b''.join(struct.pack('<h', max(-32768, min(32767, int(s * 32767)))) for s in samples)
    subprocess.run(
        [
            'ffmpeg', '-y', '-loglevel', 'error',
            '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
            '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2',
            str(path),
        ],
        input=raw,
        check=True,
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (build, peak) in CLIPS.items():
        samples = normalize(build(), peak)
        encode(OUT / name, samples)
        print(f'{name}: {len(samples) / SR:.3f}s peak {peak} dB')


if __name__ == '__main__':
    main()
