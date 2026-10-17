import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ taskId: string }> };

/** Polls an async video generation task created by /api/ai/video. */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { taskId } = await params;
  try {
    const zai = await ZAI.create();
    const result = await zai.async.result.query(taskId);
    if (result.task_status === "SUCCESS") {
      const url =
        result.video_result?.[0]?.url || result.video_url || result.url || result.video || null;
      if (!url) {
        return NextResponse.json({ status: "FAILED", error: "Generation finished but no video was returned." });
      }
      // Cover image (if provided) is passed through as well
      const coverUrl = result.video_result?.[0]?.cover_image_url || null;
      return NextResponse.json({ status: "SUCCESS", videoUrl: url, coverUrl });
    }
    if (result.task_status === "FAIL" || result.task_status === "FAILED") {
      return NextResponse.json({ status: "FAILED", error: "The video generation task failed." });
    }
    return NextResponse.json({ status: result.task_status || "PROCESSING" });
  } catch (err) {
    console.error("[ai/video-status]", err);
    return NextResponse.json({ status: "FAILED", error: "Could not check the generation status." }, { status: 500 });
  }
}
