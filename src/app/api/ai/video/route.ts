import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";
import { getSessionUser } from "@/lib/auth";

const schema = z.object({
  prompt: z.string().trim().min(3, "Describe the video you want").max(1500),
  quality: z.enum(["speed", "quality"]).optional(),
  withAudio: z.boolean().optional(),
  fps: z.union([z.literal(30), z.literal(60)]).optional(),
  duration: z.union([z.literal(5), z.literal(10)]).optional(),
});

/** Creates an async text-to-video task. Poll via /api/ai/video-status?taskId=... */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const zai = await ZAI.create();
    const task = await zai.video.generations.create({
      prompt: parsed.data.prompt,
      quality: parsed.data.quality || "speed",
      with_audio: parsed.data.withAudio ?? false,
      fps: parsed.data.fps || 30,
      duration: parsed.data.duration || 5,
    });
    if (!task?.id) {
      return NextResponse.json({ error: "The video service did not accept the task. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ taskId: task.id, status: task.task_status || "PROCESSING" });
  } catch (err) {
    console.error("[ai/video]", err);
    return NextResponse.json({ error: "Video generation could not be started. Please try again shortly." }, { status: 500 });
  }
}
