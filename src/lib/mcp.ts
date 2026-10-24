/**
 * MCP (Model Context Protocol) tool layer for VisionCut AI.
 *
 * Exposes the editor's AI capabilities as MCP tools so Claude (Desktop, Code,
 * or claude.ai connectors) can drive them remotely. The wire protocol lives in
 * src/app/api/mcp/route.ts (JSON-RPC 2.0 over Streamable HTTP, stateless).
 *
 * Auth: MCP_TOKEN env — accepted as "Authorization: Bearer <token>" or
 * "?key=<token>" on the URL (the URL form is what Claude Desktop custom
 * connectors need, since they send no headers).
 *
 * Tools reuse the same provider-agnostic engines as the app itself:
 *   llm.ts (storyboard) · image.ts · voiceover.ts · video.ts · stickers.ts · db.ts
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { generateChatCompletion, extractJsonObject, llmDiagnostics } from "@/lib/llm";
import { generateImage, imageDiagnostics, ImageError } from "@/lib/image";
import { generateVoiceover, voiceoverDiagnostics, VoiceoverError } from "@/lib/voiceover";
import { submitVideoGeneration, pollVideoGeneration, videoDiagnostics, getWavespeedBalance, getKieCredit, VideoError } from "@/lib/video";
import { searchStickers, STICKER_GROUPS } from "@/lib/stickers";
import { db } from "@/lib/db";

export interface McpContentBlock {
  type: string;
  text?: string;
  data?: string; // base64 (no data: prefix)
  mimeType?: string;
  name?: string;
  url?: string;
}

export interface McpToolResult {
  content: McpContentBlock[];
  isError?: boolean;
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Tool schemas                                                        */
/* ------------------------------------------------------------------ */

const StatusArgs = z.object({}).partial().optional();
const ListProjectsArgs = z.object({ limit: z.number().int().min(1).max(50).optional() }).optional();

const SearchStickersArgs = z.object({
  query: z.string().trim().min(1).max(80),
  group: z.string().trim().max(30).optional(),
  limit: z.number().int().min(1).max(48).optional(),
});

const StoryboardArgs = z.object({
  script: z.string().trim().min(20, "Script must be at least 20 characters").max(6000),
  style: z.string().trim().max(60).optional(),
  aspect_ratio: z.string().trim().max(10).optional(),
});

const ImageArgs = z.object({
  prompt: z.string().trim().min(3).max(1500),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:5", "21:9"]).optional(),
  save_to_library: z.boolean().optional(),
});

const VoiceoverArgs = z.object({
  text: z.string().trim().min(1).max(2000),
  voice: z.enum(["female", "male", "teenager", "child", "elderly", "whisper"]).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  quality: z.enum(["fast", "hd"]).optional(),
  save_to_library: z.boolean().optional(),
});

const StartVideoArgs = z.object({
  prompt: z.string().trim().min(3).max(2000),
  duration: z.union([z.literal(5), z.literal(10)]).optional(),
  quality: z.enum(["speed", "quality"]).optional(),
  with_audio: z.boolean().optional(),
  fps: z.union([z.literal(30), z.literal(60)]).optional(),
});

const CheckVideoArgs = z.object({
  task_id: z.string().trim().min(3).max(200),
});

const CreateProjectArgs = z.object({
  name: z.string().trim().min(1).max(80),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:5", "21:9"]).optional(),
});

const ImportMediaArgs = z.object({
  url: z.string().trim().url().max(2048),
  name: z.string().trim().min(1).max(80).optional(),
  duration_seconds: z.number().min(0.1).max(600).optional(),
});

const AddToProjectArgs = z.object({
  project_id: z.string().trim().min(3).max(40),
  media_id: z.string().trim().regex(/^as_[a-z0-9]+$/, "media_id must be an asset id (as_...) from visioncut_import_media, visioncut_generate_image or visioncut_generate_voiceover"),
  at_seconds: z.number().min(0).max(3600).optional(),
  duration: z.number().min(0.1).max(600).optional(),
  track_type: z.enum(["video", "audio"]).optional(),
});

/* ------------------------------------------------------------------ */
/* Tool definitions                                                    */
/* ------------------------------------------------------------------ */

const STORYBOARD_SYSTEM =
  "You are a professional video director and storyboard artist. You convert scripts into precise, production-ready storyboards. Always answer with valid JSON matching the requested schema, nothing else.";
const STORYBOARD_SCHEMA_INSTRUCTION = `Return STRICT JSON only (no markdown fences) shaped as:
{"title":string,"scenes":[{"index":number,"visual":string,"narration":string,"caption":string,"transition":"cut"|"fade"|"slide","durationSeconds":number,"imagePrompt":string}],"musicSuggestion":string}
Rules: 3-6 scenes. durationSeconds between 3 and 8. imagePrompt is an English text-to-image prompt describing the scene visually, rich in detail, no text/watermarks in the image.`;

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "visioncut_status",
    description:
      "Report which VisionCut AI engines are configured (video, image, voiceover, script LLM, stickers) and how many projects exist. No secrets are returned. Call this first to see what is usable.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "visioncut_list_projects",
    description:
      "List the user's VisionCut editor projects (name, aspect ratio, track/clip counts, last updated). Read-only.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 50, description: "Max projects to return (default 20)" } },
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_search_stickers",
    description:
      "Search 1800+ free transparent-PNG stickers (OpenMoji, CC BY-SA 4.0). Supports Arabic, English and emoji queries (e.g. 'قطة', 'rocket', '🐼'). Returns CDN URLs that can be downloaded and inserted into any editor.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text (Arabic, English or an emoji)" },
        group: { type: "string", description: `Optional group filter. One of: ${STICKER_GROUPS.map((g) => g.id).join(", ")}` },
        limit: { type: "integer", minimum: 1, maximum: 48, description: "Max results (default 12)" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_generate_storyboard",
    description:
      "Turn a script into a production-ready storyboard (3-6 scenes with visuals, narration, captions, transitions, durations, image prompts and a music suggestion). Same engine as the editor's Script → Video panel.",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", minLength: 20, maxLength: 6000, description: "The raw script/story text" },
        style: { type: "string", description: "Visual style, e.g. cinematic, documentary, energetic, minimal, playful" },
        aspect_ratio: { type: "string", description: "Target aspect ratio, e.g. 16:9 (default), 9:16" },
      },
      required: ["script"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_generate_image",
    description:
      "Generate an image from a text prompt (WaveSpeed z-image/turbo, ~$0.005; free pollinations.ai fallback when WaveSpeed is out of credits; premium opt-in via IMAGE_PROVIDER=kie). Returns the image bytes as an MCP image block AND — by default — saves it into the user's cloud library, returning an asset_id that visioncut_add_to_project can place directly on a timeline (no public URL needed). Set save_to_library=false to skip saving. Supports 16:9, 9:16, 1:1, 4:5, 21:9.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", minLength: 3, maxLength: 1500 },
        aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1", "4:5", "21:9"] },
        save_to_library: { type: "boolean", description: "Save into the cloud library and return an asset_id for timeline placement (default true)" },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_generate_voiceover",
    description:
      "Text-to-speech narration (WaveSpeed; free google-translate-tts fallback when WaveSpeed is out of credits). Speaks 600+ languages including Arabic. voice: female|male|teenager|child|elderly|whisper. quality: 'fast' ($0.005) or 'hd' ($0.04). Returns the audio as an MCP audio block AND — by default — saves it into the cloud library with an asset_id for visioncut_add_to_project (audio track). Set save_to_library=false to skip saving.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, maxLength: 2000 },
        voice: { type: "string", enum: ["female", "male", "teenager", "child", "elderly", "whisper"] },
        speed: { type: "number", minimum: 0.5, maximum: 2 },
        quality: { type: "string", enum: ["fast", "hd"] },
        save_to_library: { type: "boolean", description: "Save into the cloud library and return an asset_id (default true)" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_start_video",
    description:
      "Start a text-to-video generation (WaveSpeed wan-2.2 ultra-fast: ~$0.01 speed / ~$0.02 quality). Returns a task_id immediately — poll it with visioncut_check_video until SUCCESS to get the MP4 URL.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", minLength: 3, maxLength: 2000, description: "Scene description for the video" },
        duration: { type: "integer", enum: [5, 10], description: "Seconds (default 5)" },
        quality: { type: "string", enum: ["speed", "quality"], description: "speed=480p ultra-fast, quality=720p ultra-fast" },
        with_audio: { type: "boolean", description: "Ask the model to generate audio (supported on some models)" },
        fps: { type: "integer", enum: [30, 60] },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_check_video",
    description:
      "Check a text-to-video task started with visioncut_start_video. Returns PENDING/PROCESSING (wait ~30-60s and call again), SUCCESS (with the MP4 URL) or FAILED (with the reason).",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string", description: "The task_id returned by visioncut_start_video (format provider:id)" } },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_create_project",
    description:
      "Create a new VisionCut editor project (visible in the user's dashboard). Returns the project id — pass it to visioncut_add_to_project to place media on its timeline.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 80 },
        aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1", "4:5", "21:9"] },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_import_media",
    description:
      "Download a media file (MP4 video, audio, or image) from a public URL into the user's VisionCut cloud library (200MB max, 1GB account quota). Returns an asset_id (format as_xxx) that visioncut_add_to_project places on a timeline. Typical use: import a video_url returned by visioncut_check_video.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Public http(s) URL of the media file" },
        name: { type: "string", maxLength: 80, description: "Display name (default: derived from the URL)" },
        duration_seconds: { type: "number", minimum: 0.1, maximum: 600, description: "Known media duration — helps place it accurately (videos from visioncut_check_video: pass the requested duration)" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_add_to_project",
    description:
      "Place an asset on a project timeline. The clip appears in the user's editor immediately (video/image go to a video track, audio to an audio track; default position: end of that track). media_id accepts asset ids from ANY source: visioncut_import_media (URL), visioncut_generate_image or visioncut_generate_voiceover (saved automatically) — no public URL required.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project id from visioncut_create_project or visioncut_list_projects" },
        media_id: { type: "string", description: "Asset id from visioncut_import_media (format as_xxx)" },
        at_seconds: { type: "number", minimum: 0, description: "Timeline position (default: end of the target track)" },
        duration: { type: "number", minimum: 0.1, description: "Clip length in seconds (default: media duration, 4s for images)" },
        track_type: { type: "string", enum: ["video", "audio"], description: "Override target track type" },
      },
      required: ["project_id", "media_id"],
      additionalProperties: false,
    },
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function splitDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return { mimeType: "application/octet-stream", base64: "" };
  return { mimeType: match[1], base64: match[2] };
}

function textResult(text: string, isError = false): McpToolResult {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

function fail(err: unknown, label: string): McpToolResult {
  if (err instanceof ImageError || err instanceof VoiceoverError || err instanceof VideoError) {
    return textResult(`${label} failed: ${err.message}`, true);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return textResult(`${label} failed: ${msg}`, true);
}

/* ------------------------------------------------------------------ */
/* Tool handlers                                                       */
/* ------------------------------------------------------------------ */

async function toolStatus(): Promise<McpToolResult> {
  let projectCount = 0;
  try {
    projectCount = await db.project.count();
  } catch {
    /* db optional for status */
  }
  const balance = await getWavespeedBalance().catch(() => null);
  const balText = balance === null ? "unknown" : `$${balance.toFixed(2)}${balance < 0.05 ? " — LOW, video generation will stop soon" : ""}`;
  const kieCredit = await getKieCredit().catch(() => null);
  const kieText = kieCredit === null ? "no key" : `key ok, credits ${kieCredit}`;
  const lines = [
    "VisionCut AI — engine status",
    `- script/LLM: provider=${llmDiagnostics().provider}, custom key=${llmDiagnostics().custom.hasKey}, model=${llmDiagnostics().custom.model}`,
    `- image: provider=${imageDiagnostics().provider}, wavespeed key=${imageDiagnostics().keys.wavespeed}, model=${imageDiagnostics().models.wavespeed}, kie opt-in=${imageDiagnostics().keys.kie ? imageDiagnostics().models.kie : "no key"} (set IMAGE_PROVIDER=kie)`,
    `- voiceover: provider=${voiceoverDiagnostics().provider}, wavespeed key=${voiceoverDiagnostics().keys.wavespeed}, fast=${voiceoverDiagnostics().models.wavespeedFast}, hd=${voiceoverDiagnostics().models.wavespeedHd}`,
    `- video: provider=${videoDiagnostics().provider}, wavespeed key=${videoDiagnostics().keys.wavespeed}, kie=${videoDiagnostics().keys.kie ? kieText : "no key"}`,
    `- free fallbacks (auto-engage when WaveSpeed fails or is out of credits): image→pollinations.ai, voiceover→google-translate-tts. Video has NO free fallback.`,
    `- WaveSpeed balance: ${balText}`,
    `- stickers: ~1800 OpenMoji entries, ${STICKER_GROUPS.length} groups, no key needed`,
    `- projects in database: ${projectCount}`,
  ];
  return textResult(lines.join("\n"));
}

async function toolListProjects(args: z.infer<typeof ListProjectsArgs>): Promise<McpToolResult> {
  const limit = args?.limit ?? 20;
  const demo = await db.user.findFirst({ where: { isDemo: true }, select: { id: true } });
  const projects = await db.project.findMany({
    where: demo ? { userId: demo.id } : {},
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, name: true, aspectRatio: true, data: true, updatedAt: true },
  });
  if (!projects.length) return textResult("No projects yet. Open the editor and create one.");
  const lines = projects.map((p) => {
    let tracks = 0;
    let clips = 0;
    try {
      const data = JSON.parse(p.data || "{}") as { tracks?: Array<{ clips?: unknown[] }>; clips?: unknown[] };
      tracks = Array.isArray(data.tracks) ? data.tracks.length : 0;
      // Editor state stores clips flat at the top level (each clip carries trackId);
      // fall back to per-track counts for any legacy shape.
      clips = Array.isArray(data.clips) ? data.clips.length : 0;
      if (!clips) clips = (data.tracks || []).reduce((n, t) => n + (Array.isArray(t.clips) ? t.clips.length : 0), 0);
    } catch {
      /* unparseable data — skip counts */
    }
    return `- ${p.name} (id=${p.id}, ${p.aspectRatio}, ${tracks} tracks / ${clips} clips, updated ${p.updatedAt.toISOString()})`;
  });
  return textResult(`Projects (${projects.length}):\n${lines.join("\n")}`);
}

async function toolSearchStickers(raw: unknown): Promise<McpToolResult> {
  const args = SearchStickersArgs.parse(raw);
  const hits = searchStickers(args.query, { group: args.group, limit: args.limit ?? 12 });
  if (!hits.length) return textResult(`No stickers found for "${args.query}". Try another word or an emoji.`);
  const lines = hits.map(
    (h, i) => `${i + 1}. ${h.emoji || "•"} ${h.annotation} [${h.source}${h.group ? `, ${h.group}` : ""}]\n   ${h.url}`,
  );
  return textResult(`Stickers for "${args.query}" (${hits.length}):\n${lines.join("\n")}`);
}

async function toolStoryboard(raw: unknown): Promise<McpToolResult> {
  const args = StoryboardArgs.parse(raw);
  const completion = await generateChatCompletion(
    [
      { role: "system", content: STORYBOARD_SYSTEM },
      {
        role: "user",
        content: `Convert this script into a scene-by-scene storyboard.\nVisual style: ${args.style || "cinematic"}\nAspect ratio: ${args.aspect_ratio || "16:9"}\n\nSCRIPT:\n${args.script}\n\n${STORYBOARD_SCHEMA_INSTRUCTION}`,
      },
    ],
    { temperature: 0.7 },
  );
  const storyboard = extractJsonObject(completion.content) as
    | { scenes?: unknown; title?: string; musicSuggestion?: string }
    | null;
  if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
    return textResult("The AI returned an unreadable storyboard. Please rephrase the script and retry.", true);
  }
  return textResult(
    `Storyboard "${storyboard.title || "Untitled"}" — ${storyboard.scenes.length} scenes (provider=${completion.provider}, model=${completion.model})\n\n` +
      JSON.stringify(storyboard, null, 2),
  );
}

async function toolGenerateImage(raw: unknown): Promise<McpToolResult> {
  const args = ImageArgs.parse(raw);
  const result = await generateImage({ prompt: args.prompt, aspectRatio: args.aspect_ratio });
  const { mimeType, base64 } = splitDataUrl(result.imageDataUrl);
  const lines = [
    `Image generated (${Math.floor((base64.length * 3) / 4)} bytes, ${mimeType}, provider=${result.provider}, model=${result.model}${result.warnings?.length ? `, warnings: ${result.warnings.join(" | ")}` : ""}).`,
  ];
  if (args.save_to_library !== false) {
    try {
      const userId = await demoUserId();
      const assetId = await storeInCloudLibrary(userId, Buffer.from(base64, "base64"), mimeType, `AI image — ${args.prompt.slice(0, 60)}`);
      lines.push(`asset_id: ${assetId}`, "Saved to the cloud library — place it on a timeline with visioncut_add_to_project (the editor restores the bytes automatically; no public URL needed).");
    } catch (err) {
      lines.push(`library save failed (${err instanceof Error ? err.message.slice(0, 120) : "db error"}) — the image block above is still usable.`);
    }
  }
  return {
    content: [{ type: "image", data: base64, mimeType }, { type: "text", text: lines.join("\n") }],
  };
}

async function toolGenerateVoiceover(raw: unknown): Promise<McpToolResult> {
  const args = VoiceoverArgs.parse(raw);
  const result = await generateVoiceover({
    text: args.text,
    voice: args.voice,
    speed: args.speed,
    quality: args.quality,
  });
  const { mimeType, base64 } = splitDataUrl(result.audioDataUrl);
  const lines = [
    `Voiceover generated (${Math.floor((base64.length * 3) / 4)} bytes, ${mimeType}, voice=${args.voice || "female"}, provider=${result.provider}, model=${result.model}). If your client cannot play the audio block, the base64 data above the metadata is the complete ${mimeType} file.`,
  ];
  if (args.save_to_library !== false) {
    try {
      const userId = await demoUserId();
      const assetId = await storeInCloudLibrary(userId, Buffer.from(base64, "base64"), mimeType, `AI voiceover — ${args.text.slice(0, 60)}`);
      lines.push(`asset_id: ${assetId}`, "Saved to the cloud library — place it on an audio track with visioncut_add_to_project.");
    } catch (err) {
      lines.push(`library save failed (${err instanceof Error ? err.message.slice(0, 120) : "db error"}) — the audio block above is still usable.`);
    }
  }
  return {
    content: [{ type: "audio", data: base64, mimeType }, { type: "text", text: lines.join("\n") }],
  };
}

async function toolStartVideo(raw: unknown): Promise<McpToolResult> {
  const args = StartVideoArgs.parse(raw);
  const result = await submitVideoGeneration({
    prompt: args.prompt,
    duration: args.duration ?? 5,
    withAudio: args.with_audio ?? false,
    fps: args.fps ?? 30,
    quality: args.quality ?? "speed",
  });
  return textResult(
    `Video task submitted.\ntask_id: ${result.taskId}\nprovider: ${result.provider}\nmodel: ${result.model}` +
      (result.warnings?.length ? `\nwarnings: ${result.warnings.join(" | ")}` : "") +
      `\n\nPoll with visioncut_check_video (typical completion: 30-90 seconds).`,
  );
}

async function toolCheckVideo(raw: unknown): Promise<McpToolResult> {
  const args = CheckVideoArgs.parse(raw);
  const result = await pollVideoGeneration(args.task_id);
  if (result.status === "SUCCESS") {
    return textResult(`Status: SUCCESS\nvideo_url: ${result.videoUrl || "(none)"}\ncover_url: ${result.coverUrl || "(none)"}\n\nDownload the MP4 from video_url.`);
  }
  if (result.status === "FAILED") {
    return textResult(`Status: FAILED\nreason: ${result.error || "unknown"}`, true);
  }
  return textResult(`Status: ${result.status}. Wait ~20-30 seconds and call visioncut_check_video again with the same task_id.`);
}

/* ------------------------------------------------------------------ */
/* Write tools (project/media persistence)                             */
/* ------------------------------------------------------------------ */

/* Mirrors src/app/api/media/init route caps. */
const CLOUD_CHUNK = 3 * 1024 * 1024; // editor complete-route expects exactly ceil(size/3MB) chunks
const MAX_IMPORT_FILE = 200 * 1024 * 1024;
const MAX_USER_CLOUD_TOTAL = 1024 * 1024 * 1024;
const IMPORT_TIMEOUT_MS = 60_000;

const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif",
};

function kindOfMime(mimeType: string): "video" | "audio" | "image" | null {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return null;
}

function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) URLs are supported.");
  const h = url.hostname.toLowerCase();
  if (
    h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "::1" || h === "[::1]" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  ) {
    throw new Error("Private/loopback hosts are not allowed.");
  }
  return url;
}

function newAssetId(): string {
  // Must satisfy /^as_[a-z0-9]+$/ (enforced by every /api/media route).
  return `as_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Store raw media bytes in the user's cloud library (MediaFile + 3MB chunks —
 * exactly ceil(size/3MB) chunks, the editor's complete-route contract).
 * Shared by visioncut_import_media (URL downloads) and the generate_* tools
 * (save_to_library) so AI output can be placed on timelines without a public URL.
 */
async function storeInCloudLibrary(userId: string, buf: Buffer, mimeType: string, name: string): Promise<string> {
  const reAgg = await db.mediaFile.aggregate({ where: { userId }, _sum: { size: true } });
  if ((reAgg._sum.size ?? 0) + buf.length > MAX_USER_CLOUD_TOTAL) {
    throw new Error("this file would exceed the 1GB cloud storage quota");
  }
  const assetId = newAssetId();
  await db.mediaFile.create({ data: { id: assetId, userId, name, mimeType, size: buf.length } });
  const chunks: Prisma.MediaChunkCreateManyInput[] = [];
  for (let off = 0, idx = 0; off < buf.length; off += CLOUD_CHUNK, idx++) {
    chunks.push({ fileId: assetId, idx, data: Buffer.from(buf.subarray(off, Math.min(off + CLOUD_CHUNK, buf.length))) });
  }
  await db.mediaChunk.createMany({ data: chunks });
  return assetId;
}

async function demoUserId(): Promise<string> {
  const user = await db.user.findFirst({ where: { isDemo: true }, select: { id: true } });
  if (!user) throw new Error("No editor account found. Open the VisionCut dashboard once to initialize it, then retry.");
  return user.id;
}

function defaultProjectData(name: string): string {
  const state = {
    version: 1,
    name,
    aspectRatio: "16:9",
    tracks: [
      { id: "v1", type: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
      { id: "a1", type: "audio", name: "Audio 1", muted: false, hidden: false, locked: false, height: 56 },
    ],
    clips: [],
    assets: [],
    duration: 0,
  };
  return JSON.stringify(state);
}

async function toolCreateProject(raw: unknown): Promise<McpToolResult> {
  const args = CreateProjectArgs.parse(raw);
  const userId = await demoUserId();
  const project = await db.project.create({
    data: { userId, name: args.name, aspectRatio: args.aspect_ratio || "16:9", data: defaultProjectData(args.name) },
    select: { id: true, name: true, aspectRatio: true },
  });
  return textResult(
    `Project created.\nproject_id: ${project.id}\nname: ${project.name}\naspect_ratio: ${project.aspectRatio}\n\nOpen it at /editor/${project.id}. Use visioncut_import_media then visioncut_add_to_project to build the timeline.`,
  );
}

async function toolImportMedia(raw: unknown): Promise<McpToolResult> {
  const args = ImportMediaArgs.parse(raw);
  const url = assertPublicHttpUrl(args.url);
  const userId = await demoUserId();

  const agg = await db.mediaFile.aggregate({ where: { userId }, _sum: { size: true } });
  if ((agg._sum.size ?? 0) >= MAX_USER_CLOUD_TOTAL) {
    return textResult("Import failed: cloud media storage is full (1GB per account). Remove old media first.", true);
  }

  // Download (size-capped).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);
  let buf: Buffer;
  let mimeType = "";
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) return textResult(`Import failed: the source returned HTTP ${res.status}.`, true);
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_IMPORT_FILE) return textResult(`Import failed: file is ${Math.round(declared / 1048576)}MB — the limit is 200MB.`, true);
    mimeType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    buf = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return textResult(aborted ? "Import failed: download timed out (60s)." : `Import failed: could not download the file (${err instanceof Error ? err.message : "network error"}).`, true);
  } finally {
    clearTimeout(timer);
  }
  if (!buf.length) return textResult("Import failed: the source returned an empty file.", true);
  if (buf.length > MAX_IMPORT_FILE) return textResult("Import failed: file exceeds the 200MB limit.", true);

  // Resolve MIME: content-type header, else extension, else reject.
  if (!kindOfMime(mimeType)) {
    const ext = (url.pathname.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    mimeType = EXT_MIME[ext] || "";
  }
  const kind = kindOfMime(mimeType);
  if (!kind) return textResult(`Import failed: unsupported file type "${mimeType || "unknown"}". Only video, audio and image files are supported.`, true);

  const name = (args.name || decodeURIComponent(url.pathname.split("/").pop() || "Imported media")).slice(0, 80);

  try {
    const assetId = await storeInCloudLibrary(userId, buf, mimeType, name);
    return textResult(
      `Media imported.\nasset_id: ${assetId}\nname: ${name}\ntype: ${mimeType} (${kind})\nsize: ${buf.length} bytes\n\nPlace it with visioncut_add_to_project (project_id + this asset_id).`,
    );
  } catch (err) {
    return textResult(`Import failed while saving: ${err instanceof Error ? err.message.slice(0, 160) : "database error"}.`, true);
  }
}

interface StoredProjectState {
  version?: number;
  tracks?: Array<{ id: string; type: "video" | "audio"; name: string; muted: boolean; hidden: boolean; locked: boolean; height: number; clips?: unknown[] }>;
  clips?: Array<Record<string, unknown>>;
  assets?: Array<Record<string, unknown>>;
  duration?: number;
}

async function toolAddToProject(raw: unknown): Promise<McpToolResult> {
  const args = AddToProjectArgs.parse(raw);
  const userId = await demoUserId();

  const project = await db.project.findFirst({
    where: { id: args.project_id, userId },
    select: { id: true, name: true, data: true },
  });
  if (!project) return textResult(`Project "${args.project_id}" was not found in your account. Use visioncut_list_projects to get valid ids.`, true);

  const media = await db.mediaFile.findFirst({
    where: { id: args.media_id, userId },
    select: { id: true, name: true, mimeType: true, size: true },
  });
  if (!media) return textResult(`Media "${args.media_id}" was not found in your library. Import it first with visioncut_import_media.`, true);
  const kind = kindOfMime(media.mimeType);
  if (!kind) return textResult(`Media "${media.id}" has an unsupported type (${media.mimeType}).`, true);

  let state: StoredProjectState;
  try {
    state = JSON.parse(project.data || "{}") as StoredProjectState;
  } catch {
    return textResult("This project's data is corrupted and cannot be updated from here.", true);
  }
  if (!Array.isArray(state.tracks) || !state.tracks.length) {
    state.tracks = [
      { id: "v1", type: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
      { id: "a1", type: "audio", name: "Audio 1", muted: false, hidden: false, locked: false, height: 56 },
    ];
  }
  state.assets = Array.isArray(state.assets) ? state.assets : [];
  state.clips = Array.isArray(state.clips) ? state.clips : [];

  // Register the asset (idempotent by id — the browser restores bytes from /api/media/{id}).
  if (!state.assets.some((a) => a.id === media.id)) {
    state.assets.push({
      id: media.id,
      kind,
      name: media.name,
      mimeType: media.mimeType,
      size: media.size,
      duration: args.duration,
      origin: "ai",
      createdAt: Date.now(),
    });
  }

  const wantType = args.track_type || (kind === "audio" ? "audio" : "video");
  let track = state.tracks.find((t) => t.type === wantType && !t.locked);
  if (!track) {
    const count = state.tracks.filter((t) => t.type === wantType).length;
    track = {
      id: `${wantType[0]}${Date.now().toString(36).slice(-6)}`,
      type: wantType,
      name: `${wantType === "video" ? "Video" : "Audio"} ${count + 1}`,
      muted: false,
      hidden: false,
      locked: false,
      height: wantType === "video" ? 64 : 56,
    };
    state.tracks.push(track);
  }

  const trackClips = state.clips.filter((c) => c.trackId === track!.id);
  const trackEnd = trackClips.reduce((m, c) => Math.max(m, Number(c.start || 0) + Number(c.duration || 0)), 0);
  const start = args.at_seconds ?? trackEnd;
  const clipDuration = args.duration ?? (kind === "image" ? 4 : 5);
  const clipId = `c_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

  state.clips.push({
    id: clipId,
    trackId: track.id,
    type: kind,
    name: media.name,
    assetId: media.id,
    start,
    duration: clipDuration,
    trimStart: 0,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    volume: 1,
    speed: 1,
    color: { brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0 },
    animation: "none",
    animationDuration: 0.6,
  });
  state.duration = state.clips.reduce((m, c) => Math.max(m, Number(c.start || 0) + Number(c.duration || 0)), 0);

  await db.project.update({ where: { id: project.id }, data: { data: JSON.stringify(state) } });
  return textResult(
    `Clip added to project "${project.name}".\nproject_id: ${project.id}\nclip_id: ${clipId}\ntrack: ${track.name} (${track.type})\nstart: ${start}s, duration: ${clipDuration}s\n\nOpen /editor/${project.id} — the editor restores the media from the cloud automatically.`,
  );
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

export async function callMcpTool(name: string, args: unknown): Promise<McpToolResult> {
  try {
    switch (name) {
      case "visioncut_status":
        StatusArgs.parse(args);
        return await toolStatus();
      case "visioncut_list_projects":
        return await toolListProjects(ListProjectsArgs.parse(args));
      case "visioncut_search_stickers":
        return await toolSearchStickers(args);
      case "visioncut_generate_storyboard":
        return await toolStoryboard(args);
      case "visioncut_generate_image":
        return await toolGenerateImage(args);
      case "visioncut_generate_voiceover":
        return await toolGenerateVoiceover(args);
      case "visioncut_start_video":
        return await toolStartVideo(args);
      case "visioncut_check_video":
        return await toolCheckVideo(args);
      case "visioncut_create_project":
        return await toolCreateProject(args);
      case "visioncut_import_media":
        return await toolImportMedia(args);
      case "visioncut_add_to_project":
        return await toolAddToProject(args);
      default:
        return textResult(`Unknown tool "${name}".`, true);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return textResult(`Invalid arguments for "${name}": ${err.issues.map((i) => `${i.path.join(".") || "args"} — ${i.message}`).join("; ")}`, true);
    }
    return fail(err, name);
  }
}
