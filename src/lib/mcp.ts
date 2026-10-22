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
import { generateChatCompletion, extractJsonObject, llmDiagnostics } from "@/lib/llm";
import { generateImage, imageDiagnostics, ImageError } from "@/lib/image";
import { generateVoiceover, voiceoverDiagnostics, VoiceoverError } from "@/lib/voiceover";
import { submitVideoGeneration, pollVideoGeneration, videoDiagnostics, VideoError } from "@/lib/video";
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
});

const VoiceoverArgs = z.object({
  text: z.string().trim().min(1).max(2000),
  voice: z.enum(["female", "male", "teenager", "child", "elderly", "whisper"]).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  quality: z.enum(["fast", "hd"]).optional(),
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
      "Generate an image from a text prompt (WaveSpeed z-image/turbo, ~$0.005). Returns the actual image bytes as an MCP image block plus metadata. Supports 16:9, 9:16, 1:1, 4:5, 21:9.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", minLength: 3, maxLength: 1500 },
        aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1", "4:5", "21:9"] },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "visioncut_generate_voiceover",
    description:
      "Text-to-speech narration (WaveSpeed). Speaks 600+ languages including Arabic. voice: female|male|teenager|child|elderly|whisper. quality: 'fast' ($0.005) or 'hd' ($0.04, higher bitrate). Returns the audio as an MCP audio block.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, maxLength: 2000 },
        voice: { type: "string", enum: ["female", "male", "teenager", "child", "elderly", "whisper"] },
        speed: { type: "number", minimum: 0.5, maximum: 2 },
        quality: { type: "string", enum: ["fast", "hd"] },
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
  const lines = [
    "VisionCut AI — engine status",
    `- script/LLM: provider=${llmDiagnostics().provider}, custom key=${llmDiagnostics().custom.hasKey}, model=${llmDiagnostics().custom.model}`,
    `- image: provider=${imageDiagnostics().provider}, wavespeed key=${imageDiagnostics().keys.wavespeed}, model=${imageDiagnostics().models.wavespeed}`,
    `- voiceover: provider=${voiceoverDiagnostics().provider}, wavespeed key=${voiceoverDiagnostics().keys.wavespeed}, fast=${voiceoverDiagnostics().models.wavespeedFast}, hd=${voiceoverDiagnostics().models.wavespeedHd}`,
    `- video: provider=${videoDiagnostics().provider}, wavespeed key=${videoDiagnostics().keys.wavespeed}`,
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
      const data = JSON.parse(p.data || "{}") as { tracks?: Array<{ clips?: unknown[] }> };
      tracks = Array.isArray(data.tracks) ? data.tracks.length : 0;
      clips = (data.tracks || []).reduce((n, t) => n + (Array.isArray(t.clips) ? t.clips.length : 0), 0);
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
  return {
    content: [
      { type: "image", data: base64, mimeType },
      {
        type: "text",
        text: `Image generated (${Math.floor((base64.length * 3) / 4)} bytes, ${mimeType}, provider=${result.provider}, model=${result.model}${result.warnings?.length ? `, warnings: ${result.warnings.join(" | ")}` : ""}).`,
      },
    ],
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
  return {
    content: [
      { type: "audio", data: base64, mimeType },
      {
        type: "text",
        text: `Voiceover generated (${Math.floor((base64.length * 3) / 4)} bytes, ${mimeType}, voice=${args.voice || "female"}, provider=${result.provider}, model=${result.model}). If your client cannot play the audio block, the base64 data above the metadata is the complete ${mimeType} file.`,
      },
    ],
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
