/**
 * Provider-agnostic text-to-video core for VisionCut AI.
 *
 * Mirrors src/lib/transcribe.ts and src/lib/llm.ts: the video-generation
 * backend is selected via env vars so the same build works in the Z.ai
 * sandbox (platform SDK) and on any hosting with a bring-your-own key
 * (fal.ai, WaveSpeed AI, KIE.AI, PixVerse).
 *
 * Env vars:
 *   VIDEO_PROVIDER         auto (default) | zai | fal | wavespeed | kie | pixverse | higgsfield
 *   VIDEO_API_KEY          Shared fallback key for whichever external provider is selected.
 *   HIGGSFIELD_API_KEY     Per-provider keys — each wins over VIDEO_API_KEY for its own
 *   FAL_API_KEY            platform, so several platforms can coexist and `auto` tries
 *   WAVESPEED_API_KEY      every provider that has a usable key. For higgsfield the key is
 *   KIE_API_KEY            the full "keyId:keySecret" pair from console.higgsfield.ai
 *   PIXVERSE_API_KEY
 *   HIGGSFIELD_VIDEO_MODEL default "alibaba/wan-3.0/text-to-video" (model slug from /models)
 *   FAL_VIDEO_MODEL        default "fal-ai/wan-t2v"  (fal.ai queue model id)
 *   WAVESPEED_VIDEO_MODEL  default "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast"
 *                          ($0.01/video — catalog: GET /api/v3/models; quality
 *                          mode auto-upgrades to the 720p tier at $0.02)
 *   KIE_VIDEO_MODEL        default "veo3-fast"
 *   PIXVERSE_VIDEO_MODEL   default "v4.5"
 *
 * `auto` resolution order:
 *   1. external providers whose credentials are present (VIDEO_API_KEY),
 *      tried in order wavespeed -> higgsfield -> fal -> kie -> pixverse
 *      (wavespeed leads: cheapest live key, 1000+ models, $0.01/video);
 *      auth/billing failures fall through to the next candidate (warnings
 *      are collected on the result so the UI can surface them)
 *   2. `zai` when a Z.ai platform config is available (sandbox)
 *   3. otherwise a clear error listing what was rejected and what to set
 *
 * When a provider is pinned it is used exclusively and its errors surface
 * as-is. Task ids are opaque to the client and are namespaced with the
 * provider ("<provider>:<id>") so /api/ai/video-status can poll the right
 * backend.
 */

import ZAI from "z-ai-web-dev-sdk";

export type VideoProviderName = "zai" | "fal" | "wavespeed" | "kie" | "pixverse" | "higgsfield";
export type VideoProviderSetting = "auto" | VideoProviderName;

export interface VideoSubmitOptions {
  prompt: string;
  duration: 5 | 10;
  withAudio: boolean;
  fps: 30 | 60;
  quality: "speed" | "quality";
}

export interface VideoSubmitResult {
  taskId: string; // "<provider>:<id>"
  provider: VideoProviderName;
  model: string;
  /** Non-fatal provider rejections that were skipped in `auto` mode. */
  warnings?: string[];
}

export type VideoPollStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface VideoPollResult {
  status: VideoPollStatus;
  videoUrl?: string;
  coverUrl?: string;
  error?: string;
}

export class VideoError extends Error {
  status: number;
  provider: string;
  constructor(message: string, status = 502, provider = "video") {
    super(message);
    this.name = "VideoError";
    this.status = status;
    this.provider = provider;
  }
}

const HTTP_TIMEOUT_MS = 30_000;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function videoKey(): string | undefined {
  return env("VIDEO_API_KEY");
}

/**
 * Per-provider key resolution: a dedicated <PROVIDER>_API_KEY wins, then the
 * shared VIDEO_API_KEY. This lets several platforms coexist — e.g. a Higgsfield
 * key on VIDEO_API_KEY plus a WaveSpeed key on WAVESPEED_API_KEY — and `auto`
 * will try every provider that has a usable key.
 */
function providerKey(provider: VideoProviderName): string | undefined {
  switch (provider) {
    case "higgsfield":
      return env("HIGGSFIELD_API_KEY") || videoKey();
    case "fal":
      return env("FAL_API_KEY") || videoKey();
    case "wavespeed":
      return env("WAVESPEED_API_KEY") || videoKey();
    case "kie":
      return env("KIE_API_KEY") || videoKey();
    case "pixverse":
      return env("PIXVERSE_API_KEY") || videoKey();
    case "zai":
      return undefined; // sandbox SDK manages its own credentials
  }
}

function providerModel(provider: VideoProviderName): string {
  switch (provider) {
    case "fal":
      return env("FAL_VIDEO_MODEL") || "fal-ai/wan-t2v";
    case "wavespeed":
      return env("WAVESPEED_VIDEO_MODEL") || "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast";
    case "kie":
      return env("KIE_VIDEO_MODEL") || "veo3-fast";
    case "pixverse":
      return env("PIXVERSE_VIDEO_MODEL") || "v4.5";
    case "higgsfield":
      return env("HIGGSFIELD_VIDEO_MODEL") || "alibaba/wan-3.0/text-to-video";
    case "zai":
      return "zai-platform-video";
  }
}

/* ------------------------------------------------------------------ */
/* Shared HTTP helper                                                  */
/* ------------------------------------------------------------------ */

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
    throw new VideoError(
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
    /* keep text */
  }
  if (!res.ok) {
    const snippet = text.replace(/\s+/g, " ").slice(0, 220);
    const map: Record<number, [number, string]> = {
      401: [502, `The ${provider} API key was rejected (401). Check VIDEO_API_KEY.`],
      402:
        [402, `${provider} account has no usable credits left (402) — top up to keep generating videos.`],
      403: [502, `The ${provider} key is not allowed for this request (403).`],
      404: [502, `${provider} model or endpoint not found (404). Check the video model id.`],
      429: [429, `${provider} rate limit exceeded (429).`],
    };
    const mapped = map[res.status];
    if (mapped) throw new VideoError(`${mapped[1]} ${snippet}`.trim(), mapped[0], provider);
    throw new VideoError(
      `${provider} request failed (HTTP ${res.status}). ${snippet}`.trim(),
      502,
      provider,
    );
  }
  return { status: res.status, body, text };
}

/* ------------------------------------------------------------------ */
/* Z.ai platform SDK (sandbox)                                         */
/* ------------------------------------------------------------------ */

interface ZaiTaskLike {
  id?: string;
  task_status?: string;
}

async function submitZai(opts: VideoSubmitOptions): Promise<VideoSubmitResult> {
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch {
    throw new VideoError(
      "Video generation has no provider on this server (the built-in engine only works in its own sandbox). " +
        "Set VIDEO_PROVIDER to your video API platform (fal | wavespeed | kie | pixverse) with a valid VIDEO_API_KEY.",
      503,
      "zai",
    );
  }
  const task = (await zai.video.generations.create({
    prompt: opts.prompt,
    quality: opts.quality,
    with_audio: opts.withAudio,
    fps: opts.fps,
    duration: opts.duration,
  })) as ZaiTaskLike;
  if (!task?.id) {
    throw new VideoError("The video service did not accept the task. Please try again.", 502, "zai");
  }
  return { taskId: `zai:${task.id}`, provider: "zai", model: "zai-platform-video" };
}

interface ZaiResultLike {
  task_status?: string;
  video_result?: Array<{ url?: string; cover_image_url?: string }>;
  video_url?: string;
  url?: string;
  video?: string;
}

async function pollZai(id: string): Promise<VideoPollResult> {
  const zai = await ZAI.create();
  const result = (await zai.async.result.query(id)) as ZaiResultLike;
  if (result.task_status === "SUCCESS") {
    const url =
      result.video_result?.[0]?.url || result.video_url || result.url || result.video || null;
    if (!url) {
      return { status: "FAILED", error: "Generation finished but no video was returned." };
    }
    return {
      status: "SUCCESS",
      videoUrl: url,
      coverUrl: result.video_result?.[0]?.cover_image_url || undefined,
    };
  }
  if (result.task_status === "FAIL" || result.task_status === "FAILED") {
    return { status: "FAILED", error: "The video generation task failed." };
  }
  return { status: "PROCESSING" };
}

/* ------------------------------------------------------------------ */
/* fal.ai (queue API — https://docs.fal.ai)                            */
/* ------------------------------------------------------------------ */

async function submitFal(opts: VideoSubmitOptions, key: string, model: string): Promise<VideoSubmitResult> {
  const numFrames = opts.duration === 10 ? 161 : 81;
  const { body } = await httpJson("fal", `https://queue.fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: opts.prompt,
      aspect_ratio: "16:9",
      resolution: "480p",
      num_frames: numFrames,
      enable_safety_checker: true,
    }),
  });
  const requestId = (body as { request_id?: string } | null)?.request_id;
  if (typeof requestId !== "string" || !requestId) {
    throw new VideoError("fal did not return a request id.", 502, "fal");
  }
  return { taskId: `fal:${requestId}`, provider: "fal", model };
}

interface FalStatusBody {
  status?: string;
  queue_position?: number;
  error?: unknown;
}

async function pollFal(id: string, key: string): Promise<VideoPollResult> {
  const headers = { Authorization: `Key ${key}` };
  const { body: statusBody } = await httpJson(
    "fal",
    `https://queue.fal.run/requests/${encodeURIComponent(id)}/status?logs=0`,
    { headers },
  );
  const st = (statusBody as FalStatusBody | null)?.status;
  if (st === "COMPLETED") {
    const { body } = await httpJson(
      "fal",
      `https://queue.fal.run/requests/${encodeURIComponent(id)}`,
      { headers },
    );
    const b = body as { video?: { url?: string }; videos?: Array<{ url?: string }>; url?: string } | null;
    const url = b?.video?.url || b?.videos?.[0]?.url || b?.url || null;
    if (!url) return { status: "FAILED", error: "fal finished but no video URL was returned." };
    return { status: "SUCCESS", videoUrl: url };
  }
  if (st === "IN_QUEUE") return { status: "PENDING" };
  if (st === "IN_PROGRESS") return { status: "PROCESSING" };
  return { status: "PROCESSING" };
}

/* ------------------------------------------------------------------ */
/* WaveSpeed AI (v3 predictions — https://wavespeed.ai/docs)           */
/* ------------------------------------------------------------------ */

async function submitWavespeed(
  opts: VideoSubmitOptions,
  key: string,
  model: string,
): Promise<VideoSubmitResult> {
  // Default model is the ultra-fast 480p tier ($0.01/video). Quality mode
  // upgrades to the 720p tier ($0.02) unless a model was pinned via env.
  let chosen = model;
  if (!env("WAVESPEED_VIDEO_MODEL") && opts.quality === "quality") {
    chosen = chosen.includes("720p") ? chosen : chosen.replace("480p", "720p");
  }
  // Request schemas differ per model family (all enforce additionalProperties
  // : false, so sending unknown fields is a hard 400) — classify by slug.
  const m = chosen.toLowerCase();
  const body: Record<string, unknown> = { prompt: opts.prompt };
  if (m.includes("wan-3.0")) {
    body.aspect_ratio = "16:9";
    body.resolution = opts.quality === "quality" ? "1080p" : "720p";
    body.duration = Math.min(30, Math.max(2, opts.duration));
    body.generate_audio = opts.withAudio;
    body.enable_prompt_expansion = true;
  } else if (m.includes("seedance")) {
    body.aspect_ratio = "16:9";
    body.duration = Math.min(12, Math.max(2, opts.duration));
  } else if (m.includes("wan-2.5")) {
    body.size = opts.quality === "quality" ? "1920*1080" : "1280*720";
    body.duration = opts.duration <= 5 ? 5 : 10;
    body.enable_prompt_expansion = true;
  } else if (m.includes("wan-2.")) {
    body.size = m.includes("720p") ? "1280*720" : "832*480";
    body.duration = opts.duration <= 5 ? 5 : 8;
  }
  // Any other family: prompt alone is always valid — model defaults apply.
  const { body: resp } = await httpJson("wavespeed", `https://api.wavespeed.ai/api/v3/${chosen}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (resp as { data?: { id?: string } } | null)?.data;
  if (!data?.id) throw new VideoError("WaveSpeed did not return a task id.", 502, "wavespeed");
  return { taskId: `wavespeed:${data.id}`, provider: "wavespeed", model: chosen };
}

interface WaveSpeedResultBody {
  data?: { status?: string; outputs?: Array<string | { url?: string }>; error?: string };
}

async function pollWavespeed(id: string, key: string): Promise<VideoPollResult> {
  const { body } = await httpJson(
    "wavespeed",
    `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(id)}/result`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const data = (body as WaveSpeedResultBody | null)?.data;
  const status = data?.status;
  if (status === "completed") {
    const outputs = data?.outputs || [];
    const first = outputs[0];
    const url = typeof first === "string" ? first : first?.url;
    if (!url) return { status: "FAILED", error: "WaveSpeed completed but returned no video." };
    return { status: "SUCCESS", videoUrl: url };
  }
  if (status && ["failed", "cancelled", "timeout", "deleted"].includes(status)) {
    const raw = data?.error || `WaveSpeed task ${status}.`;
    // Surface a actionable message when the task died from an empty balance.
    if (/insufficient|not enough|balance|credit/i.test(raw)) {
      return {
        status: "FAILED",
        error:
          `${raw} — WaveSpeed credits are exhausted. Video is the only engine without a free fallback: ` +
          "top up at https://console.wavespeed.ai/billing to restore video generation (images and voiceover keep working for free).",
      };
    }
    return { status: "FAILED", error: raw };
  }
  if (status === "created") return { status: "PENDING" };
  return { status: "PROCESSING" };
}

/* ------------------------------------------------------------------ */
/* KIE.AI (jobs API — https://docs.kie.ai)                             */
/* ------------------------------------------------------------------ */

async function submitKie(opts: VideoSubmitOptions, key: string, model: string): Promise<VideoSubmitResult> {
  const { body } = await httpJson("kie", "https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: { prompt: opts.prompt } }),
  });
  const body2 = body as { code?: number; msg?: string; data?: { taskId?: string } } | null;
  if (body2?.code && body2.code !== 200) {
    if (body2.code === 401) {
      throw new VideoError("The kie API key was rejected (401). Check VIDEO_API_KEY.", 502, "kie");
    }
    throw new VideoError(`KIE.AI error ${body2.code}: ${body2.msg || "unknown"}`, 502, "kie");
  }
  const data = body2?.data;
  if (!data?.taskId) throw new VideoError("KIE.AI did not return a task id.", 502, "kie");
  return { taskId: `kie:${data.taskId}`, provider: "kie", model };
}

interface KieResultBody {
  data?: { state?: string; resultJson?: string; failMsg?: string };
}

async function pollKie(id: string, key: string): Promise<VideoPollResult> {
  const { body } = await httpJson(
    "kie",
    `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const data = (body as KieResultBody | null)?.data;
  const state = data?.state;
  if (state === "success") {
    let url: string | null = null;
    try {
      const parsed = JSON.parse(data?.resultJson || "{}") as { resultUrls?: string[] };
      url = parsed.resultUrls?.[0] || null;
    } catch {
      /* ignore */
    }
    if (!url) return { status: "FAILED", error: "KIE.AI finished but returned no video URL." };
    return { status: "SUCCESS", videoUrl: url };
  }
  if (state === "fail") return { status: "FAILED", error: data?.failMsg || "KIE.AI task failed." };
  if (state === "waiting" || state === "queuing") return { status: "PENDING" };
  return { status: "PROCESSING" };
}

/* ------------------------------------------------------------------ */
/* PixVerse (openapi v2 — https://docs.platform.pixverse.ai)           */
/* ------------------------------------------------------------------ */

async function submitPixverse(
  opts: VideoSubmitOptions,
  key: string,
  model: string,
): Promise<VideoSubmitResult> {
  const { body } = await httpJson(
    "pixverse",
    "https://app-api.pixverse.ai/openapi/v2/video/text/generate",
    {
      method: "POST",
      headers: {
        "API-KEY": key,
        "Ai-Trace-Id": `visioncut-${Date.now()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        aspect_ratio: "16:9",
        duration: String(opts.duration),
        quality: "540p",
        ai_model: model,
      }),
    },
  );
  const root = body as { ErrCode?: number; ErrMsg?: string; Resp?: { video_id?: number | string } } | null;
  if (root?.ErrCode && root.ErrCode !== 0) {
    if (root.ErrCode === 10005) {
      throw new VideoError("The pixverse API key is not registered (rejected). Check VIDEO_API_KEY.", 502, "pixverse");
    }
    throw new VideoError(`PixVerse error ${root.ErrCode}: ${root.ErrMsg || "unknown"}`, 502, "pixverse");
  }
  const resp = root?.Resp;
  if (!resp?.video_id) throw new VideoError("PixVerse did not return a video id.", 502, "pixverse");
  return { taskId: `pixverse:${resp.video_id}`, provider: "pixverse", model };
}

interface PixverseResultBody {
  ErrCode?: number;
  ErrMsg?: string;
  Resp?: { status?: number; url?: string; cover_url?: string; msg?: string };
}

async function pollPixverse(id: string, key: string): Promise<VideoPollResult> {
  const { body } = await httpJson(
    "pixverse",
    `https://app-api.pixverse.ai/openapi/v2/video/result/${encodeURIComponent(id)}`,
    { headers: { "API-KEY": key, "Ai-Trace-Id": `visioncut-${Date.now()}` } },
  );
  const root = body as PixverseResultBody | null;
  if (root?.ErrCode && root.ErrCode !== 0) {
    return { status: "FAILED", error: root.ErrMsg || `PixVerse error ${root.ErrCode}.` };
  }
  const resp = root?.Resp;
  // PixVerse status codes: 1 = generating, 5 = success, 7 = content-moderation failure
  if (resp?.status === 5) {
    if (!resp.url) return { status: "FAILED", error: "PixVerse finished but returned no video URL." };
    return { status: "SUCCESS", videoUrl: resp.url, coverUrl: resp.cover_url || undefined };
  }
  if (resp?.status === 7) {
    return { status: "FAILED", error: resp.msg || "PixVerse rejected the prompt (moderation)." };
  }
  return { status: "PROCESSING" };
}

/* ------------------------------------------------------------------ */
/* Higgsfield (queue API — https://docs.higgsfield.ai)                  */
/* VIDEO_API_KEY = "keyId:keySecret", sent as `Authorization: Key ...`   */
/* ------------------------------------------------------------------ */

async function submitHiggsfield(
  opts: VideoSubmitOptions,
  key: string,
  model: string,
): Promise<VideoSubmitResult> {
  let body: unknown;
  try {
    ({ body } = await httpJson("higgsfield", `https://api.higgsfield.ai/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        duration: opts.duration,
        resolution: opts.quality === "quality" ? "1080p" : "720p",
        aspect_ratio: "16:9",
        generate_audio: opts.withAudio,
      }),
    }));
  } catch (err) {
    if (err instanceof VideoError && /not_enough_credits/i.test(err.message)) {
      throw new VideoError(
        "Higgsfield account is out of credits — top up at console.higgsfield.ai, then try again.",
        402,
        "higgsfield",
      );
    }
    throw err;
  }
  const requestId = (body as { request_id?: string } | null)?.request_id;
  if (typeof requestId !== "string" || !requestId) {
    throw new VideoError("Higgsfield did not return a request id.", 502, "higgsfield");
  }
  return { taskId: `higgsfield:${requestId}`, provider: "higgsfield", model };
}

interface HiggsfieldStatusBody {
  status?: "queued" | "in_progress" | "nsfw" | "failed" | "completed" | "canceled";
  error?: string | null;
  video?: { url?: string } | null;
  images?: Array<{ url?: string }> | null;
  audios?: Array<{ url?: string }> | null;
}

async function pollHiggsfield(id: string, key: string): Promise<VideoPollResult> {
  const { body } = await httpJson(
    "higgsfield",
    `https://api.higgsfield.ai/requests/${encodeURIComponent(id)}/status`,
    { headers: { Authorization: `Key ${key}` } },
  );
  const b = (body as HiggsfieldStatusBody | null) || {};
  switch (b.status) {
    case "completed": {
      const url = b.video?.url || b.images?.[0]?.url || b.audios?.[0]?.url || null;
      if (!url) return { status: "FAILED", error: "Higgsfield finished but returned no video URL." };
      return { status: "SUCCESS", videoUrl: url };
    }
    case "failed":
      return { status: "FAILED", error: b.error || "Higgsfield task failed." };
    case "nsfw":
      return { status: "FAILED", error: "Higgsfield rejected the prompt (content moderation)." };
    case "canceled":
      return { status: "FAILED", error: "Higgsfield task was canceled." };
    case "queued":
      return { status: "PENDING" };
    default:
      return { status: "PROCESSING" };
  }
}

/* ------------------------------------------------------------------ */
/* Resolution chain                                                    */
/* ------------------------------------------------------------------ */

function providerOrder(selected: VideoProviderSetting): VideoProviderName[] {
  if (selected !== "auto") return [selected];
  const order: VideoProviderName[] = [];
  for (const p of ["wavespeed", "higgsfield", "fal", "kie", "pixverse"] as VideoProviderName[]) {
    if (providerKey(p)) order.push(p);
  }
  order.push("zai");
  return order;
}

async function submitProvider(
  provider: VideoProviderName,
  opts: VideoSubmitOptions,
): Promise<VideoSubmitResult> {
  const key = providerKey(provider);
  const model = providerModel(provider);
  switch (provider) {
    case "fal":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for fal.", 503, "fal");
      return submitFal(opts, key, model);
    case "wavespeed":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for wavespeed.", 503, "wavespeed");
      return submitWavespeed(opts, key, model);
    case "kie":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for kie.", 503, "kie");
      return submitKie(opts, key, model);
    case "pixverse":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for pixverse.", 503, "pixverse");
      return submitPixverse(opts, key, model);
    case "higgsfield":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for higgsfield.", 503, "higgsfield");
      return submitHiggsfield(opts, key, model);
    case "zai":
      return submitZai(opts);
  }
}

/** Live WaveSpeed credit balance (null when unknown/unavailable). Never leaks the key. */
export async function getWavespeedBalance(): Promise<number | null> {
  const key = env("WAVESPEED_API_KEY") || videoKey();
  if (!key) return null;
  try {
    const { body, status } = await httpJson("wavespeed", "https://api.wavespeed.ai/api/v3/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (status !== 200) return null;
    const bal = (body as { data?: { balance?: number } } | null)?.data?.balance;
    return typeof bal === "number" ? bal : null;
  } catch {
    return null;
  }
}

/**
 * Submit a text-to-video task using the configured provider chain.
 * In `auto` mode, auth/billing failures on external providers fall through
 * to the next candidate; pinned providers surface errors as-is.
 */
export async function submitVideoGeneration(
  opts: VideoSubmitOptions,
): Promise<VideoSubmitResult> {
  const selected = (env("VIDEO_PROVIDER") as VideoProviderSetting | undefined) || "auto";
  const order = providerOrder(selected);
  const pinned = selected !== "auto";
  const failures: string[] = [];
  const warnings: string[] = [];
  let wavespeedOutOfCredits = false;

  for (const provider of order) {
    try {
      const result = await submitProvider(provider, opts);
      if (warnings.length) result.warnings = warnings;
      return result;
    } catch (err) {
      const ve = err instanceof VideoError ? err : new VideoError(String(err), 502, provider);
      if (ve.status === 402 && provider === "wavespeed") wavespeedOutOfCredits = true;
      // Sandbox-only provider (zai) outside the sandbox or any pinned failure stops the chain.
      if (pinned) throw ve;
      const short = ve.message.replace(/\s+/g, " ").slice(0, 180);
      failures.push(`${provider}: ${ve.message}`);
      warnings.push(`${provider}: ${short}`);
      console.warn(`[video] provider ${provider} failed (status ${ve.status}), trying next...`);
    }
  }
  if (wavespeedOutOfCredits) {
    const bal = await getWavespeedBalance();
    throw new VideoError(
      `WaveSpeed credits are exhausted${bal !== null ? ` (remaining balance $${bal.toFixed(2)})` : ""}. ` +
        "Video is the only engine without a free fallback — top up at https://console.wavespeed.ai/billing to restore video generation. " +
        "Images and voiceover keep working via the free engines.",
      402,
      "wavespeed",
    );
  }
  throw new VideoError(
    "No video provider accepted the task. " +
      (failures.length
        ? `Provider results — ${failures.join(" | ")}`
        : "Set VIDEO_PROVIDER and VIDEO_API_KEY, or use the Z.ai sandbox."),
    503,
    "video",
  );
}

/** Poll a previously submitted task ("<provider>:<id>"). */
export async function pollVideoGeneration(taskId: string): Promise<VideoPollResult> {
  const sep = taskId.indexOf(":");
  const provider = (sep === -1 ? "zai" : taskId.slice(0, sep)) as VideoProviderName;
  const id = sep === -1 ? taskId : taskId.slice(sep + 1);
  const key = providerKey(provider);

  if (!/^[a-z0-9A-Z_\-\.]+$/.test(id)) {
    throw new VideoError("Malformed task id.", 400, "video");
  }

  switch (provider) {
    case "zai":
      return pollZai(id);
    case "fal":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for fal.", 503, "fal");
      return pollFal(id, key);
    case "wavespeed":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for wavespeed.", 503, "wavespeed");
      return pollWavespeed(id, key);
    case "kie":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for kie.", 503, "kie");
      return pollKie(id, key);
    case "pixverse":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for pixverse.", 503, "pixverse");
      return pollPixverse(id, key);
    case "higgsfield":
      if (!key) throw new VideoError("VIDEO_API_KEY is not configured for higgsfield.", 503, "higgsfield");
      return pollHiggsfield(id, key);
    default:
      throw new VideoError(`Unknown video provider "${provider}" in task id.`, 400, "video");
  }
}

/** Masked diagnostics for a health endpoint (never leaks the key). */
export function videoDiagnostics() {
  return {
    provider: env("VIDEO_PROVIDER") || "auto",
    hasKey: !!videoKey(),
    keys: {
      higgsfield: !!env("HIGGSFIELD_API_KEY") || !!videoKey(),
      fal: !!env("FAL_API_KEY") || !!videoKey(),
      wavespeed: !!env("WAVESPEED_API_KEY") || !!videoKey(),
      kie: !!env("KIE_API_KEY") || !!videoKey(),
      pixverse: !!env("PIXVERSE_API_KEY") || !!videoKey(),
    },
    models: {
      higgsfield: providerModel("higgsfield"),
      fal: providerModel("fal"),
      wavespeed: providerModel("wavespeed"),
      kie: providerModel("kie"),
      pixverse: providerModel("pixverse"),
    },
    zai: { available: true },
  };
}
