#!/usr/bin/env python3
"""Upbeat acoustic-ish bed: Karplus-Strong plucks (C-G-Am-F, 120bpm) + soft shaker + bass.
Output: /home/z/my-project/download/claude-ugc/music.wav (~28s, 44.1kHz stereo)
"""
import numpy as np
import wave

SR = 44100
BPM = 120.0
EIGHTH = 60.0 / BPM / 2.0          # 0.25 s
TOTAL = 28.0
N = int(SR * TOTAL)
mixL = np.zeros(N)
mixR = np.zeros(N)
rng = np.random.default_rng(7)

def pluck(freq, dur, bright=0.5):
    """Karplus-Strong string."""
    n = int(SR * dur)
    period = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, period)
    buf = np.convolve(buf, [bright, 1 - bright], mode="same")  # pre-shape
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    env = np.exp(-np.linspace(0, 4.0, n))
    return out * env

def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    seg = sig[:max(0, N - i0)] * gain
    mixL[i0:i0 + len(seg)] += seg * (1 - max(0, pan))
    mixR[i0:i0 + len(seg)] += seg * (1 + min(0, pan))

# note frequencies
F = {"C3":130.81,"E3":164.81,"F3":174.61,"G3":196.0,"A3":220.0,"B3":246.94,
     "C4":261.63,"D4":293.66,"E4":329.63,"F4":349.23,"G4":392.0,"A4":440.0,"B4":493.88,
     "C5":523.25,"D5":587.33,"E5":659.26,"F5":698.46,"G5":783.99}

# I-V-vi-IV in C: C (C E G), G (D G B), Am (A C E), F (F A C) — arpeggio patterns
CHORDS = [
    ["C4","E4","G4","C5"],
    ["G4","B4","D5","G5"],
    ["A4","C5","E5","A4"],
    ["F4","A4","C5","F5"],
]
BASS = ["C3","G3","A3","F3"]

bar = 2.0  # 4 beats at 120bpm = 2s
t = 0.0
bar_i = 0
while t < TOTAL - 0.5:
    ch = CHORDS[bar_i % 4]
    # arpeggio: 8 eighths per bar, up-down pattern
    pattern = [0, 1, 2, 3, 2, 1, 2, 3]
    for k, step in enumerate(pattern):
        f = F[ch[step]]
        add(pluck(f, 1.2, bright=0.6), t + k * EIGHTH, gain=0.16, pan=0.3 if k % 2 else -0.3)
    # bass root on beats 1 and 3
    add(pluck(F[BASS[bar_i % 4]], 1.0, bright=0.2), t, gain=0.22)
    add(pluck(F[BASS[bar_i % 4]], 1.0, bright=0.2), t + 1.0, gain=0.18)
    t += bar
    bar_i += 1

# soft shaker on offbeats
t = EIGHTH
while t < TOTAL - 0.1:
    n = int(0.05 * SR)
    noise = rng.uniform(-1, 1, n) * np.exp(-np.linspace(0, 6, n))
    # bandpass-ish: differentiate
    noise = np.diff(noise, prepend=0)
    add(noise, t, gain=0.05, pan=0.15)
    t += EIGHTH

# gentle fade in/out
fade_in = int(0.4 * SR)
fade_out = int(2.0 * SR)
for m in (mixL, mixR):
    m[:fade_in] *= np.linspace(0, 1, fade_in)
    m[-fade_out:] *= np.linspace(1, 0, fade_out)

# normalize to -3 dB peak
peak = max(np.abs(mixL).max(), np.abs(mixR).max())
g = 0.708 / peak
mixL *= g
mixR *= g

pcm = np.stack([mixL, mixR], axis=1)
pcm16 = (np.clip(pcm, -1, 1) * 32767).astype(np.int16)
with wave.open("/home/z/my-project/download/claude-ugc/music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm16.tobytes())
print("music.wav written:", TOTAL, "s")
