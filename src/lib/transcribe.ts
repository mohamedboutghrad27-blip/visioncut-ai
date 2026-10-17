import ZAI from "z-ai-web-dev-sdk";

/**
 * Provider-agnostic speech-to-text (ASR) core for VisionCut AI.
 *
 * The transcription backend is selected via env vars so the same build works
 * in the Z.ai sandbox (platform ASR) and on any hosting (bring-your-own key).
 *
 * Env vars:
 *   TRANSCRIBE_PROVIDER  auto (default) | zai | openai | groq | lemonfox |
 *                        custom | deepgram | gladia | assemblyai | elevenlabs
 *   TRANSCRIBE_API_KEY   API key for the chosen provider
 *   TRANSCRIBE_BASE_URL  endpoint for `custom` (any OpenAI-compatible host),
 *                        e.g. https://api.example.com/v1
 *   TRANSCRIBE_MODEL     optional model override (whisper-1, whisper-large-v3,
 *                        nova-3, scribe_v1, ...)
 *
 * `auto` resolution order:
 *   1. `custom` when TRANSCRIBE_BASE_URL + TRANSCRIBE_API_KEY are both set
 *   2. `zai` when a Z.ai platform config is available (sandbox)
 *   3. otherwise a clear 503 explaining what to configure
 */

export type TranscribeProvider =
  | "auto"
  | "zai"
  | "openai"
  | "groq"
  | "lemonfox"
  | "custom"
  | "deepgram"
  | "gladia"
  | "assemblyai"
  | "elevenlabs";

export interface TranscribeInput {
  audioBase64: string;
  /** MIME type of the audio, defaults to audio/wav */
  mimeType?: string;
  /** Optional ISO language hint (e.g. "en", "fr", "ar") */
  languageHint?: string;
}

export interface TranscribeResult {
  text: string;
  provider: string;
}

export class TranscribeError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "TranscribeError";
    this.status = status;
  }
}

const OPENAI_COMPAT_DEFAULTS: Partial<Record<TranscribeProvider, { baseUrl: string; model: string }>> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "whisper-1" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "whisper-large-v3" },
  lemonfox: { baseUrl: "https://api.lemonfox.ai/v1", model: "whisper-1" },
};

const DEFAULT_TIMEOUT_MS = 120_000;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function apiKey(): string | undefined {
  return env("TRANSCRIBE_API_KEY");
}

function baseUrlOverride(): string | undefined {
  const v = env("TRANSCRIBE_BASE_URL");
  return v ? v.replace(/\/+$/, "") : undefined;
}

function modelOverride(fallback: string): string {
  return env("TRANSCRIBE_MODEL") || fallback;
}

function toBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

async function upstreamFailure(provider: string, res: Response): Promise<TranscribeError> {
  let snippet = "";
  try {
    snippet = (await res.text()).slice(0, 220).replace(/\s+/g, " ");
  } catch {
    /* ignore */
  }
  const map: Record<number, [number, string]> = {
    401: [502, `The ${provider} API key was rejected (401). Check TRANSCRIBE_API_KEY.`],
    403: [502, `The ${provider} API key is not allowed for this request (403). Check key scopes/permissions.`],
    404: [502, `${provider} endpoint not found (404). Check TRANSCRIBE_BASE_URL.`],
    413: [413, `Audio file too large for ${provider}.`],
    429: [429, `${provider} rate limit or quota exceeded (429).`],
  };
  const mapped = map[res.status];
  if (mapped) return new TranscribeError(`${mapped[1]} ${snippet}`.trim(), mapped[0]);
  return new TranscribeError(
    `${provider} request failed (HTTP ${res.status}). ${snippet}`.trim(),
    res.status >= 500 ? 502 : 502,
  );
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible (OpenAI, Groq, Lemonfox, custom endpoints)        */
/* ------------------------------------------------------------------ */

async function transcribeOpenAICompat(
  input: TranscribeInput,
  provider: string,
  baseUrl: string,
  defaultModel: string,
): Promise<TranscribeResult> {
  const key = apiKey();
  if (!key) throw new TranscribeError(`TRANSCRIBE_API_KEY is not set for provider "${provider}".`, 503);
  const bytes = toBytes(input.audioBase64);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: input.mimeType || "audio/wav" }), "audio.wav");
  form.append("model", modelOverride(defaultModel));
  if (input.languageHint) form.append("language", input.languageHint);
  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw await upstreamFailure(provider, res);
  const data = (await res.json()) as { text?: string };
  const text = (data.text || "").trim();
  if (!text) throw new TranscribeError(`${provider} returned an empty transcript.`, 422);
  return { text, provider };
}

/* ------------------------------------------------------------------ */
/* Deepgram                                                            */
/* ------------------------------------------------------------------ */

async function transcribeDeepgram(input: TranscribeInput): Promise<TranscribeResult> {
  const key = apiKey();
  if (!key) throw new TranscribeError('TRANSCRIBE_API_KEY is not set for provider "deepgram".', 503);
  const bytes = toBytes(input.audioBase64);
  const params = new URLSearchParams({
    model: modelOverride("nova-3"),
    smart_format: "true",
    punctuate: "true",
  });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": input.mimeType || "audio/wav",
    },
    body: bytes,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw await upstreamFailure("Deepgram", res);
  const data = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const text = (data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "").trim();
  if (!text) throw new TranscribeError("Deepgram returned an empty transcript.", 422);
  return { text, provider: "deepgram" };
}

/* ------------------------------------------------------------------ */
/* Gladia                                                              */
/* ------------------------------------------------------------------ */

async function transcribeGladia(input: TranscribeInput): Promise<TranscribeResult> {
  const key = apiKey();
  if (!key) throw new TranscribeError('TRANSCRIBE_API_KEY is not set for provider "gladia".', 503);
  const bytes = toBytes(input.audioBase64);
  const form = new FormData();
  form.append("audio", new Blob([bytes], { type: input.mimeType || "audio/wav" }), "audio.wav");
  const res = await fetch("https://api.gladia.io/v2/transcription?async=false&beep=false", {
    method: "POST",
    headers: { "x-gladia-key": key },
    body: form,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw await upstreamFailure("Gladia", res);
  const data = (await res.json()) as {
    transcription?: { full_transcript?: string; utterances?: { transcription?: string }[] };
    text?: string;
  };
  const text =
    (data.transcription?.full_transcript ||
      data.text ||
      (data.transcription?.utterances || [])
        .map((u) => u.transcription || "")
        .join(" ")).trim();
  if (!text) throw new TranscribeError("Gladia returned an empty transcript.", 422);
  return { text, provider: "gladia" };
}

/* ------------------------------------------------------------------ */
/* AssemblyAI                                                          */
/* ------------------------------------------------------------------ */

async function transcribeAssemblyAI(input: TranscribeInput): Promise<TranscribeResult> {
  const key = apiKey();
  if (!key) throw new TranscribeError('TRANSCRIBE_API_KEY is not set for provider "assemblyai".', 503);
  const bytes = toBytes(input.audioBase64);
  const upload = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/octet-stream" },
    body: bytes,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!upload.ok) throw await upstreamFailure("AssemblyAI upload", upload);
  const { upload_url: uploadUrl } = (await upload.json()) as { upload_url?: string };
  if (!uploadUrl) throw new TranscribeError("AssemblyAI upload did not return a URL.", 502);

  const create = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ audio_url: uploadUrl, ...(input.languageHint ? { language_code: input.languageHint } : {}) }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!create.ok) throw await upstreamFailure("AssemblyAI", create);
  const created = (await create.json()) as { id?: string };
  if (!created.id) throw new TranscribeError("AssemblyAI did not return a transcript id.", 502);

  // Poll until done (bounded)
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${created.id}`, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(30_000),
    });
    if (!poll.ok) throw await upstreamFailure("AssemblyAI", poll);
    const job = (await poll.json()) as { status?: string; text?: string; error?: string };
    if (job.status === "completed") {
      const text = (job.text || "").trim();
      if (!text) throw new TranscribeError("AssemblyAI returned an empty transcript.", 422);
      return { text, provider: "assemblyai" };
    }
    if (job.status === "error") {
      throw new TranscribeError(`AssemblyAI transcription failed: ${job.error || "unknown error"}`, 502);
    }
  }
  throw new TranscribeError("AssemblyAI transcription timed out.", 504);
}

/* ------------------------------------------------------------------ */
/* ElevenLabs Scribe                                                   */
/* ------------------------------------------------------------------ */

async function transcribeElevenLabs(input: TranscribeInput): Promise<TranscribeResult> {
  const key = apiKey();
  if (!key) throw new TranscribeError('TRANSCRIBE_API_KEY is not set for provider "elevenlabs".', 503);
  const bytes = toBytes(input.audioBase64);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: input.mimeType || "audio/wav" }), "audio.wav");
  form.append("model_id", modelOverride("scribe_v1"));
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw await upstreamFailure("ElevenLabs", res);
  const data = (await res.json()) as { text?: string };
  const text = (data.text || "").trim();
  if (!text) throw new TranscribeError("ElevenLabs returned an empty transcript.", 422);
  return { text, provider: "elevenlabs" };
}

/* ------------------------------------------------------------------ */
/* Z.ai platform ASR (sandbox)                                         */
/* ------------------------------------------------------------------ */

async function transcribeZai(input: TranscribeInput): Promise<TranscribeResult> {
  try {
    const zai = await ZAI.create();
    const result = await zai.audio.asr.create({ file_base64: input.audioBase64 });
    const text = (result.text || "").trim();
    if (!text) throw new TranscribeError("Z.ai ASR returned an empty transcript.", 422);
    return { text, provider: "zai" };
  } catch (err) {
    if (err instanceof TranscribeError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/config/i.test(msg)) {
      throw new TranscribeError(
        "No transcription provider available here. Set TRANSCRIBE_PROVIDER " +
          "(openai|groq|lemonfox|deepgram|gladia|assemblyai|elevenlabs) or TRANSCRIBE_BASE_URL + TRANSCRIBE_API_KEY.",
        503,
      );
    }
    throw new TranscribeError(`Z.ai ASR failed: ${msg.slice(0, 200)}`, 502);
  }
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

function resolveChain(provider: string): TranscribeProvider[] {
  if (provider && provider !== "auto") return [provider as TranscribeProvider];
  const chain: TranscribeProvider[] = [];
  const base = baseUrlOverride();
  if (base && apiKey()) chain.push("custom");
  chain.push("zai");
  return chain;
}

/** Resolve provider chain and transcribe, with clear errors. */
export async function transcribeAudio(input: TranscribeInput): Promise<TranscribeResult> {
  const provider = (env("TRANSCRIBE_PROVIDER") || "auto").toLowerCase();
  const chain = resolveChain(provider);
  let lastError: unknown;
  for (const p of chain) {
    try {
      switch (p) {
        case "zai":
          return await transcribeZai(input);
        case "openai":
        case "groq":
        case "lemonfox": {
          const d = OPENAI_COMPAT_DEFAULTS[p]!;
          const base = p === "openai" ? (baseUrlOverride() || d.baseUrl) : d.baseUrl;
          return await transcribeOpenAICompat(input, p, base, d.model);
        }
        case "custom": {
          const base = baseUrlOverride();
          if (!base) throw new TranscribeError('Provider "custom" requires TRANSCRIBE_BASE_URL.', 503);
          return await transcribeOpenAICompat(input, "custom", base, "whisper-1");
        }
        case "deepgram":
          return await transcribeDeepgram(input);
        case "gladia":
          return await transcribeGladia(input);
        case "assemblyai":
          return await transcribeAssemblyAI(input);
        case "elevenlabs":
          return await transcribeElevenLabs(input);
        default:
          throw new TranscribeError(`Unknown TRANSCRIBE_PROVIDER "${p}".`, 503);
      }
    } catch (err) {
      lastError = err;
      // Only continue the auto chain when the provider is simply unavailable.
      if (err instanceof TranscribeError && err.status === 503) continue;
      throw err;
    }
  }
  if (lastError instanceof TranscribeError) throw lastError;
  throw new TranscribeError(
    "Transcription is not configured. Set TRANSCRIBE_PROVIDER (openai|groq|lemonfox|deepgram|gladia|assemblyai|elevenlabs) " +
      "or TRANSCRIBE_BASE_URL for any OpenAI-compatible endpoint, plus TRANSCRIBE_API_KEY.",
    503,
  );
}

/** Masked diagnostics for the GET handler / status checks. */
export function transcribeStatus() {
  const provider = (env("TRANSCRIBE_PROVIDER") || "auto").toLowerCase();
  const chain = resolveChain(provider);
  return {
    provider,
    chain,
    hasApiKey: Boolean(apiKey()),
    baseUrl: baseUrlOverride() || null,
    model: env("TRANSCRIBE_MODEL") || null,
  };
}
