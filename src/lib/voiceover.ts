/**
 * Provider-agnostic text-to-speech (voiceover) core for VisionCut AI.
 *
 * Mirrors src/lib/video.ts and src/lib/image.ts: the TTS backend is selected
 * via env vars so the same build works in the Z.ai sandbox (platform SDK) and
 * on any hosting with a bring-your-own key (WaveSpeed AI).
 *
 * Env vars:
 *   VOICEOVER_PROVIDER        auto (default) | zai | wavespeed
 *   WAVESPEED_API_KEY         shared with video + image engines — one key, three engines
 *   WAVESPEED_TTS_FAST_MODEL  default "wavespeed-ai/omnivoice/text-to-speech" ($0.005/run,
 *                             600+ languages incl. Arabic, voice shaped via attributes)
 *   WAVESPEED_TTS_HD_MODEL    default "minimax/speech-2.5-turbo-preview" ($0.04/run,
 *                             explicit language_boost:Arabic, 128kbps/32kHz, emotion control)
 *
 * `auto` resolution order:
 *   1. `wavespeed` when a key is present (works on Vercel + sandbox)
 *   2. `google` — FREE fallback via Google Translate TTS, no API key
 *      (keeps working at $0 balance; single narrator voice, normal/slow speed)
 *   3. `zai` when a Z.ai platform config is available (sandbox)
 *   4. otherwise a clear error listing what to set
 *
 * WaveSpeed flow: POST /api/v3/{model} (async) -> poll /api/v3/predictions/
 * {id}/result -> outputs[0] URL -> fetch bytes -> base64 data URL (audio/mpeg),
 * so the client keeps receiving `audioDataUrl` exactly as with the Z.ai engine.
 *
 * Voice ids accepted from the client (see AiPanel VOICES): female | male |
 * child | teenager | elderly | whisper. Each maps to provider-native values:
 *   - omnivoice: voice_description attributes — ONLY the whitelisted English
 *     attributes are valid (female, male, child, teenager, elderly, whisper,
 *     low pitch, moderate pitch, ...). Unsupported words hard-fail the task.
 *   - minimax: preset voice_id (Calm_Woman, Deep_Voice_Man, ...).
 */

import ZAI from "z-ai-web-dev-sdk";

export type VoiceoverProviderName = "zai" | "wavespeed" | "google";
export type VoiceoverProviderSetting = "auto" | VoiceoverProviderName;

export interface VoiceoverOptions {
  text: string;
  voice?: string;
  speed?: number;
  quality?: "fast" | "hd";
}

export interface VoiceoverResult {
  audioDataUrl: string; // "data:audio/mpeg;base64,..."
  provider: VoiceoverProviderName;
  model: string;
  warnings?: string[];
}

export class VoiceoverError extends Error {
  status: number;
  provider: string;
  constructor(message: string, status = 502, provider = "voiceover") {
    super(message);
    this.name = "VoiceoverError";
    this.status = status;
    this.provider = provider;
  }
}

const HTTP_TIMEOUT_MS = 30_000;
const GENERATE_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1_500;

/** Arabic Unicode block — used to unlock minimax `language_boost: Arabic`. */
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F]/;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function providerKey(provider: VoiceoverProviderName): string | undefined {
  switch (provider) {
    case "wavespeed":
      return env("WAVESPEED_API_KEY");
    case "google":
    case "zai":
      return undefined; // google-translate is keyless; the sandbox SDK manages its own credentials
  }
}

function providerModel(provider: VoiceoverProviderName, quality: "fast" | "hd"): string {
  switch (provider) {
    case "wavespeed":
      return quality === "hd"
        ? env("WAVESPEED_TTS_HD_MODEL") || "minimax/speech-2.5-turbo-preview"
        : env("WAVESPEED_TTS_FAST_MODEL") || "wavespeed-ai/omnivoice/text-to-speech";
    case "google":
      return "google-translate-tts";
    case "zai":
      return "zai-platform-tts";
  }
}

/** Client voice id -> omnivoice voice_description. ONLY whitelisted attributes. */
const OMNIVOICE_VOICE: Record<string, string> = {
  female: "female, moderate pitch",
  male: "male, low pitch",
  child: "child, high pitch",
  teenager: "teenager, high pitch",
  elderly: "elderly, moderate pitch",
  whisper: "female, whisper",
};

/** Client voice id -> minimax preset voice_id (system voices). */
const MINIMAX_VOICE: Record<string, string> = {
  female: "Calm_Woman",
  male: "Deep_Voice_Man",
  child: "Sweet_Girl_2",
  teenager: "Lively_Girl",
  elderly: "Wise_Woman",
  whisper: "Calm_Woman",
};

async function httpJson(
  provider: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? HTTP_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new VoiceoverError(
      aborted
        ? `${provider} request timed out.`
        : `Could not reach ${provider} (${new URL(url).host}). Check network.`,
      aborted ? 504 : 502,
      provider,
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body, text };
}

/* ------------------------------------------------------------------ */
/* WaveSpeed AI (v3 predictions — same API as video + image engines)   */
/* ------------------------------------------------------------------ */

async function generateWavespeedVoiceover(
  opts: VoiceoverOptions,
  key: string,
): Promise<VoiceoverResult> {
  const quality = opts.quality === "hd" ? "hd" : "fast";
  const model = providerModel("wavespeed", quality);
  const speed = opts.speed && opts.speed > 0 ? opts.speed : 1;

  let payload: Record<string, unknown>;
  if (model.includes("omnivoice")) {
    payload = {
      text: opts.text,
      speed,
      voice_description: OMNIVOICE_VOICE[opts.voice || "female"] || OMNIVOICE_VOICE.female,
    };
  } else if (model.includes("minimax")) {
    payload = {
      text: opts.text,
      voice_id: MINIMAX_VOICE[opts.voice || "female"] || MINIMAX_VOICE.female,
      format: "mp3",
      speed: Math.min(2, Math.max(0.5, speed)),
      ...(ARABIC_RE.test(opts.text) ? { language_boost: "Arabic" } : {}),
    };
  } else {
    // Unknown custom model — send only the safe common fields.
    payload = { text: opts.text };
  }

  const { body, status } = await httpJson("wavespeed", `https://api.wavespeed.ai/api/v3/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (status === 401) {
    throw new VoiceoverError(
      "The WaveSpeed API key was rejected (401). Check WAVESPEED_API_KEY.",
      502,
      "wavespeed",
    );
  }
  const detail = (body as { message?: string } | null)?.message || "";
  // WaveSpeed reports an empty balance as 402/403 or as 400 "Insufficient credits".
  if (status === 402 || status === 403 || (status === 400 && /insufficient/i.test(detail))) {
    throw new VoiceoverError(
      `WaveSpeed credits are exhausted (${status}) — falling back to the free engine. Top up at https://console.wavespeed.ai/billing. ${detail}`.trim(),
      502,
      "wavespeed",
    );
  }
  const data = (body as { data?: { id?: string } } | null)?.data;
  if (!data?.id) throw new VoiceoverError("WaveSpeed did not return a task id.", 502, "wavespeed");

  // Poll until completed (TTS is fast — seconds).
  const deadline = Date.now() + GENERATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const poll = await httpJson(
      "wavespeed",
      `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(data.id)}/result`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const pd = (poll.body as
      | { data?: { status?: string; outputs?: unknown[]; error?: string } }
      | null)?.data;
    const st = pd?.status;
    if (st === "completed") {
      const first = pd?.outputs?.[0];
      const url = typeof first === "string" && first.startsWith("http") ? first : null;
      if (!url) throw new VoiceoverError("WaveSpeed completed but returned no audio URL.", 502, "wavespeed");
      return { audioDataUrl: await fetchAudioAsDataUrl(url), provider: "wavespeed", model };
    }
    if (st && ["failed", "cancelled", "timeout", "deleted"].includes(st)) {
      throw new VoiceoverError(pd?.error || `WaveSpeed TTS task ${st}.`, 502, "wavespeed");
    }
    // created / processing -> keep polling
  }
  throw new VoiceoverError("WaveSpeed text-to-speech timed out.", 504, "wavespeed");
}

async function fetchAudioAsDataUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new VoiceoverError(`Could not download the generated audio (HTTP ${res.status}).`, 502, "wavespeed");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 512) throw new VoiceoverError("The speech service returned no audio. Try shorter text.", 502, "wavespeed");
    const type = res.headers.get("content-type")?.split(";")[0] || "audio/mpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch (err) {
    if (err instanceof VoiceoverError) throw err;
    throw new VoiceoverError("Could not download the generated audio.", 502, "wavespeed");
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Google Translate TTS (free fallback — no API key required)          */
/* ------------------------------------------------------------------ */

const GOOGLE_TTS_MAX_CHUNK = 180; // translate_tts rejects >~200 chars

/** Split text into <=180-char chunks at sentence boundaries, then words. */
export function chunkForGoogleTts(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  const pieces = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?؟۔،؛;:])\s*/);
  for (const piece of pieces) {
    const p = piece.trim();
    if (!p) continue;
    if (p.length > GOOGLE_TTS_MAX_CHUNK) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      let line = "";
      for (const word of p.split(" ")) {
        if ((line + " " + word).trim().length > GOOGLE_TTS_MAX_CHUNK) {
          if (line.trim()) chunks.push(line.trim());
          line = word;
        } else {
          line = (line + " " + word).trim();
        }
      }
      if (line.trim()) chunks.push(line.trim());
      continue;
    }
    if ((current + " " + p).trim().length > GOOGLE_TTS_MAX_CHUNK) {
      if (current.trim()) chunks.push(current.trim());
      current = p;
    } else {
      current = (current + " " + p).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

async function generateGoogleVoiceover(opts: VoiceoverOptions): Promise<VoiceoverResult> {
  const lang = ARABIC_RE.test(opts.text) ? "ar" : "en";
  const chunks = chunkForGoogleTts(opts.text);
  if (!chunks.length) throw new VoiceoverError("No speakable text provided.", 400, "google");
  const speed = opts.speed ?? 1;
  // translate_tts supports normal (1) and slow (0.24) playback only.
  const ttsspeed = speed < 0.95 ? "0.24" : "1";

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
      `&tl=${lang}&ttsspeed=${ttsspeed}&q=${encodeURIComponent(chunk)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; VisionCutAI/1.0)" },
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new VoiceoverError(
        aborted ? "The free TTS engine timed out." : "Could not reach the free TTS engine (translate.google.com).",
        aborted ? 504 : 502,
        "google",
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new VoiceoverError(`The free TTS engine failed (HTTP ${res.status}).`, 502, "google");
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 512) {
      throw new VoiceoverError("The free TTS engine returned no audio.", 502, "google");
    }
    buffers.push(buf);
  }
  const audio = Buffer.concat(buffers);
  const warnings = [
    "voiceover rendered by the free fallback engine (google-translate-tts) — single narrator voice, limited speed control",
  ];
  if (speed > 1.3) warnings.push("the free engine supports normal speed only");
  return {
    audioDataUrl: `data:audio/mpeg;base64,${audio.toString("base64")}`,
    provider: "google",
    model: "google-translate-tts",
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Z.ai platform SDK (sandbox)                                         */
/* ------------------------------------------------------------------ */

async function generateZaiVoiceover(opts: VoiceoverOptions): Promise<VoiceoverResult> {
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch {
    throw new VoiceoverError(
      "Voiceover has no provider on this server (the built-in engine only works in its own sandbox). " +
        "Set WAVESPEED_API_KEY to enable WaveSpeed text-to-speech.",
      503,
      "zai",
    );
  }
  const response = await zai.audio.tts.create({
    input: opts.text,
    voice: opts.voice || "tongtong",
    speed: opts.speed ?? 1.0,
    response_format: "wav",
    stream: false,
  });
  const contentType = response.headers.get("content-type") || "audio/wav";
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength < 512) {
    throw new VoiceoverError("The speech service returned no audio. Try shorter text.", 502, "zai");
  }
  const base64 = Buffer.from(new Uint8Array(arrayBuffer)).toString("base64");
  return {
    audioDataUrl: `data:${contentType.split(";")[0]};base64,${base64}`,
    provider: "zai",
    model: "zai-platform-tts",
  };
}

/* ------------------------------------------------------------------ */
/* Resolution chain                                                    */
/* ------------------------------------------------------------------ */

function providerOrder(selected: VoiceoverProviderSetting): VoiceoverProviderName[] {
  if (selected !== "auto") return [selected];
  const order: VoiceoverProviderName[] = [];
  if (providerKey("wavespeed")) order.push("wavespeed");
  order.push("google"); // free — always available as a fallback
  order.push("zai");
  return order;
}

export async function generateVoiceover(opts: VoiceoverOptions): Promise<VoiceoverResult> {
  const selected = (env("VOICEOVER_PROVIDER") as VoiceoverProviderSetting | undefined) || "auto";
  const order = providerOrder(selected);
  const pinned = selected !== "auto";
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const provider of order) {
    try {
      if (provider === "wavespeed") {
        const key = providerKey("wavespeed");
        if (!key) throw new VoiceoverError("WAVESPEED_API_KEY is not configured.", 503, "wavespeed");
        return await generateWavespeedVoiceover(opts, key);
      }
      if (provider === "google") {
        return await generateGoogleVoiceover(opts);
      }
      return await generateZaiVoiceover(opts);
    } catch (err) {
      const ve = err instanceof VoiceoverError ? err : new VoiceoverError(String(err), 502, provider);
      if (pinned) throw ve;
      const short = ve.message.replace(/\s+/g, " ").slice(0, 180);
      failures.push(`${provider}: ${ve.message}`);
      warnings.push(`${provider}: ${short}`);
      console.warn(`[voiceover] provider ${provider} failed (status ${ve.status}), trying next...`);
    }
  }
  throw new VoiceoverError(
    "No voiceover provider accepted the task. " +
      (failures.length ? `Provider results — ${failures.join(" | ")}` : "Set WAVESPEED_API_KEY, or use the Z.ai sandbox."),
    503,
    "voiceover",
  );
}

/** Masked diagnostics for a health endpoint (never leaks the key). */
export function voiceoverDiagnostics() {
  return {
    provider: env("VOICEOVER_PROVIDER") || "auto",
    keys: { wavespeed: !!env("WAVESPEED_API_KEY") },
    models: {
      wavespeedFast: providerModel("wavespeed", "fast"),
      wavespeedHd: providerModel("wavespeed", "hd"),
    },
    google: { available: true, note: "free fallback, no key needed" },
    zai: { available: true },
  };
}
