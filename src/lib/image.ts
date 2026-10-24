/**
 * Provider-agnostic text-to-image core for VisionCut AI.
 *
 * Mirrors src/lib/video.ts: the image-generation backend is selected via env
 * vars so the same build works in the Z.ai sandbox (platform SDK) and on any
 * hosting with a bring-your-own key (WaveSpeed AI).
 *
 * Env vars:
 *   IMAGE_PROVIDER         auto (default) | zai | wavespeed
 *   WAVESPEED_API_KEY      shared with the video engine — one key, both engines
 *   WAVESPEED_IMAGE_MODEL  default "wavespeed-ai/z-image/turbo" ($0.005/image;
 *                          catalog: GET https://api.wavespeed.ai/api/v3/models —
 *                          164 text-to-image models incl. seedream-v4.5 $0.04,
 *                          google/nano-banana-2.1 $0.04, flux-3 $0.05)
 *
 * `auto` resolution order:
 *   1. `wavespeed` when a key is present (works on Vercel + sandbox)
 *   2. `pollinations` — FREE fallback, no API key (keeps working at $0 balance)
 *   3. `zai` when a Z.ai platform config is available (sandbox)
 *   4. otherwise a clear error listing what to set
 *
 * When WaveSpeed runs out of credits (402) the chain silently falls through
 * to Pollinations, so image generation — and everything built on it
 * (storyboards, MCP generate_image) — keeps working for free.
 *
 * WaveSpeed flow: POST /api/v3/{model} (async) -> poll /api/v3/predictions/
 * {id}/result -> outputs[0] URL -> fetch bytes -> base64 data URL, so the
 * client keeps receiving `imageDataUrl` exactly as with the Z.ai engine.
 */

import ZAI from "z-ai-web-dev-sdk";

export type ImageProviderName = "zai" | "wavespeed" | "pollinations";
export type ImageProviderSetting = "auto" | ImageProviderName;

export interface ImageGenOptions {
  prompt: string;
  aspectRatio?: string;
}

export interface ImageGenResult {
  imageDataUrl: string; // "data:image/<fmt>;base64,..."
  provider: ImageProviderName;
  model: string;
  warnings?: string[];
}

export class ImageError extends Error {
  status: number;
  provider: string;
  constructor(message: string, status = 502, provider = "image") {
    super(message);
    this.name = "ImageError";
    this.status = status;
    this.provider = provider;
  }
}

const HTTP_TIMEOUT_MS = 30_000;
const GENERATE_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1_500;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function providerKey(provider: ImageProviderName): string | undefined {
  switch (provider) {
    case "wavespeed":
      return env("WAVESPEED_API_KEY");
    case "pollinations":
    case "zai":
      return undefined; // pollinations is keyless; the sandbox SDK manages its own credentials
  }
}

function providerModel(provider: ImageProviderName): string {
  switch (provider) {
    case "wavespeed":
      return env("WAVESPEED_IMAGE_MODEL") || "wavespeed-ai/z-image/turbo";
    case "pollinations":
      return "pollinations-flux";
    case "zai":
      return "zai-platform-image";
  }
}

/** "1344x768" (route convention) -> "1344*768" (WaveSpeed convention), clamped. */
function waveSpeedSize(aspectRatio?: string): string {
  const MAP: Record<string, string> = {
    "16:9": "1344*768",
    "9:16": "768*1344",
    "1:1": "1024*1024",
    "4:5": "864*1152",
    "21:9": "1440*720",
  };
  return MAP[aspectRatio || "16:9"] || MAP["16:9"];
}

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
    throw new ImageError(
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
/* WaveSpeed AI (v3 predictions — same API as the video engine)        */
/* ------------------------------------------------------------------ */

async function generateWavespeedImage(opts: ImageGenOptions, key: string): Promise<ImageGenResult> {
  const model = providerModel("wavespeed");
  const { body, status } = await httpJson("wavespeed", `https://api.wavespeed.ai/api/v3/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: opts.prompt, size: waveSpeedSize(opts.aspectRatio) }),
  });
  if (status === 401) {
    throw new ImageError("The WaveSpeed API key was rejected (401). Check WAVESPEED_API_KEY.", 502, "wavespeed");
  }
  if (status === 402 || status === 403) {
    const detail = (body as { message?: string } | null)?.message || "";
    throw new ImageError(
      `WaveSpeed rejected the task (${status}) — the account may be out of credits. ${detail}`.trim(),
      502,
      "wavespeed",
    );
  }
  const data = (body as { data?: { id?: string } } | null)?.data;
  if (!data?.id) throw new ImageError("WaveSpeed did not return a task id.", 502, "wavespeed");

  // Poll until completed (images are fast — seconds, not minutes).
  const deadline = Date.now() + GENERATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const poll = await httpJson(
      "wavespeed",
      `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(data.id)}/result`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const pd = (poll.body as { data?: { status?: string; outputs?: unknown[]; error?: string } } | null)?.data;
    const st = pd?.status;
    if (st === "completed") {
      const first = pd?.outputs?.[0];
      const url = typeof first === "string" && first.startsWith("http") ? first : null;
      if (!url) throw new ImageError("WaveSpeed completed but returned no image URL.", 502, "wavespeed");
      return { imageDataUrl: await fetchAsDataUrl(url), provider: "wavespeed", model };
    }
    if (st && ["failed", "cancelled", "timeout", "deleted"].includes(st)) {
      throw new ImageError(pd?.error || `WaveSpeed image task ${st}.`, 502, "wavespeed");
    }
    // created / running -> keep polling
  }
  throw new ImageError("WaveSpeed image generation timed out.", 504, "wavespeed");
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new ImageError(`Could not download the generated image (HTTP ${res.status}).`, 502, "wavespeed");
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new ImageError("The generated image was empty.", 502, "wavespeed");
    const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch (err) {
    if (err instanceof ImageError) throw err;
    throw new ImageError("Could not download the generated image.", 502, "wavespeed");
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Pollinations.ai (free fallback — no API key required)               */
/* ------------------------------------------------------------------ */

const POLLINATIONS_SIZE: Record<string, [number, number]> = {
  "16:9": [1344, 768],
  "9:16": [768, 1344],
  "1:1": [1024, 1024],
  "4:5": [864, 1152],
  "21:9": [1440, 720],
};

async function generatePollinationsImage(opts: ImageGenOptions): Promise<ImageGenResult> {
  const [width, height] =
    POLLINATIONS_SIZE[opts.aspectRatio || "16:9"] || POLLINATIONS_SIZE["16:9"];
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(opts.prompt.slice(0, 900))}` +
    `?width=${width}&height=${height}&nologo=true&seed=${seed}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ImageError(
      aborted
        ? "The free image engine timed out."
        : "Could not reach the free image engine (pollinations.ai).",
      aborted ? 504 : 502,
      "pollinations",
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new ImageError(`The free image engine failed (HTTP ${res.status}).`, 502, "pollinations");
  }
  const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!type.startsWith("image/")) {
    throw new ImageError("The free image engine returned a non-image response.", 502, "pollinations");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 512) {
    throw new ImageError("The free image engine returned an empty image.", 502, "pollinations");
  }
  return { imageDataUrl: `data:${type};base64,${buf.toString("base64")}`, provider: "pollinations", model: "pollinations-flux" };
}

/* ------------------------------------------------------------------ */
/* Z.ai platform SDK (sandbox)                                         */
/* ------------------------------------------------------------------ */

async function generateZaiImage(opts: ImageGenOptions): Promise<ImageGenResult> {
  const SIZE_BY_RATIO: Record<string, string> = {
    "16:9": "1344x768",
    "9:16": "768x1344",
    "1:1": "1024x1024",
    "4:5": "864x1152",
    "21:9": "1440x720",
  };
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch {
    throw new ImageError(
      "Image generation has no provider on this server (the built-in engine only works in its own sandbox). " +
        "Set WAVESPEED_API_KEY to enable WaveSpeed image generation.",
      503,
      "zai",
    );
  }
  const response = await zai.images.generations.create({
    prompt: opts.prompt,
    size: (SIZE_BY_RATIO[opts.aspectRatio || "16:9"] || "1344x768") as "1024x1024",
  });
  const base64 = response.data?.[0]?.base64;
  if (!base64) throw new ImageError("The image service returned no data.", 502, "zai");
  return { imageDataUrl: `data:image/png;base64,${base64}`, provider: "zai", model: "zai-platform-image" };
}

/* ------------------------------------------------------------------ */
/* Resolution chain                                                    */
/* ------------------------------------------------------------------ */

function providerOrder(selected: ImageProviderSetting): ImageProviderName[] {
  if (selected !== "auto") return [selected];
  const order: ImageProviderName[] = [];
  if (providerKey("wavespeed")) order.push("wavespeed");
  order.push("pollinations"); // free — always available as a fallback
  order.push("zai");
  return order;
}

export async function generateImage(
  opts: ImageGenOptions,
): Promise<ImageGenResult> {
  const selected = (env("IMAGE_PROVIDER") as ImageProviderSetting | undefined) || "auto";
  const order = providerOrder(selected);
  const pinned = selected !== "auto";
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const provider of order) {
    try {
      if (provider === "wavespeed") {
        const key = providerKey("wavespeed");
        if (!key) throw new ImageError("WAVESPEED_API_KEY is not configured.", 503, "wavespeed");
        return await generateWavespeedImage(opts, key);
      }
      if (provider === "pollinations") {
        return await generatePollinationsImage(opts);
      }
      return await generateZaiImage(opts);
    } catch (err) {
      const ie = err instanceof ImageError ? err : new ImageError(String(err), 502, provider);
      if (pinned) throw ie;
      const short = ie.message.replace(/\s+/g, " ").slice(0, 180);
      failures.push(`${provider}: ${ie.message}`);
      warnings.push(`${provider}: ${short}`);
      console.warn(`[image] provider ${provider} failed (status ${ie.status}), trying next...`);
    }
  }
  throw new ImageError(
    "No image provider accepted the task. " +
      (failures.length ? `Provider results — ${failures.join(" | ")}` : "Set WAVESPEED_API_KEY, or use the Z.ai sandbox."),
    503,
    "image",
  );
}

/** Masked diagnostics for a health endpoint (never leaks the key). */
export function imageDiagnostics() {
  return {
    provider: env("IMAGE_PROVIDER") || "auto",
    keys: { wavespeed: !!env("WAVESPEED_API_KEY") },
    models: { wavespeed: providerModel("wavespeed") },
    pollinations: { available: true, note: "free fallback, no key needed" },
    zai: { available: true },
  };
}
