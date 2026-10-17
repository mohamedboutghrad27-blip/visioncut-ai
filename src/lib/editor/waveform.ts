"use client";

/* Audio waveform peak extraction (cached per asset id). */

const peaksCache = new Map<string, number[]>();
const inflight = new Map<string, Promise<number[]>>();

let sharedCtx: AudioContext | null = null;
function audioCtx(): AudioContext {
  if (!sharedCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

const MAX_DECODE_SIZE = 120 * 1024 * 1024; // don't attempt decode beyond ~120MB

export async function computePeaks(assetId: string, blob: Blob, buckets = 600): Promise<number[]> {
  const cached = peaksCache.get(assetId);
  if (cached) return cached;
  const running = inflight.get(assetId);
  if (running) return running;
  if (blob.size > MAX_DECODE_SIZE) return [];

  const job = (async () => {
    try {
      const buf = await blob.arrayBuffer();
      const ctx = audioCtx();
      const audio = await ctx.decodeAudioData(buf);
      const data = audio.getChannelData(0);
      const block = Math.floor(data.length / buckets) || 1;
      const peaks: number[] = new Array(buckets).fill(0);
      for (let i = 0; i < buckets; i++) {
        let max = 0;
        const startIdx = i * block;
        const endIdx = Math.min(data.length, startIdx + block);
        for (let j = startIdx; j < endIdx; j += 4) { // stride for speed
          const v = Math.abs(data[j]);
          if (v > max) max = v;
        }
        peaks[i] = max;
      }
      const norm = Math.max(0.02, ...peaks);
      const normalized = peaks.map((p) => p / norm);
      peaksCache.set(assetId, normalized);
      return normalized;
    } catch {
      return [];
    } finally {
      inflight.delete(assetId);
    }
  })();
  inflight.set(assetId, job);
  return job;
}

/** Extract the audio track of any media file as 16-bit mono WAV base64 (for ASR). */
export async function extractAudioToWavBase64(blob: Blob, maxDurationSec = 300): Promise<{ base64: string; duration: number } | null> {
  try {
    if (blob.size > MAX_DECODE_SIZE) return null;
    const buf = await blob.arrayBuffer();
    const ctx = audioCtx();
    const audio = await ctx.decodeAudioData(buf);
    const duration = Math.min(audio.duration, maxDurationSec);
    const sampleRate = audio.sampleRate;
    const len = Math.floor(duration * sampleRate);
    // mix down to mono
    const mono = new Float32Array(len);
    const channels = Math.min(2, audio.numberOfChannels);
    for (let ch = 0; ch < channels; ch++) {
      const data = audio.getChannelData(ch);
      for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
    }
    // encode WAV
    const wav = encodeWav(mono, sampleRate);
    // base64 in chunks to avoid stack overflow
    const bytes = new Uint8Array(wav);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
    }
    return { base64: btoa(binary), duration };
  } catch {
    return null;
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
