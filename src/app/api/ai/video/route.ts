import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { submitVideoGeneration, VideoError, videoDiagnostics } from "@/lib/video";

export const maxDuration = 60;

const schema = z.object({
  prompt: z.string().trim().min(3, "Describe the video you want").max(1500),
  quality: z.enum(["speed", "quality"]).optional(),
  withAudio: z.boolean().optional(),
  fps: z.union([z.literal(30), z.literal(60)]).optional(),
  duration: z.union([z.literal(5), z.literal(10)]).optional(),
});

/** Creates an async text-to-video task. Poll via /api/ai/video-status/<taskId>. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const result = await submitVideoGeneration({
      prompt: parsed.data.prompt,
      duration: parsed.data.duration ?? 5,
      withAudio: parsed.data.withAudio ?? false,
      fps: parsed.data.fps ?? 30,
      quality: parsed.data.quality ?? "speed",
    });
    return NextResponse.json({
      taskId: result.taskId,
      provider: result.provider,
      model: result.model,
      warnings: result.warnings ?? [],
    });
  } catch (err) {
    if (err instanceof VideoError) {
      console.error("[ai/video]", err.provider, err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[ai/video]", err);
    return NextResponse.json(
      { error: "Video generation could not be started. Please try again shortly." },
      { status: 500 },
    );
  }
}

/** Masked diagnostics: which video backend is wired. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(videoDiagnostics());
}
