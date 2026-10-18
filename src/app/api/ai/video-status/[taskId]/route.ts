import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pollVideoGeneration, VideoError } from "@/lib/video";

type Params = { params: Promise<{ taskId: string }> };

/** Polls an async video generation task created by /api/ai/video. */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { taskId } = await params;
  try {
    const result = await pollVideoGeneration(taskId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VideoError) {
      console.error("[ai/video-status]", err.provider, err.status, err.message);
      return NextResponse.json({ status: "FAILED", error: err.message }, { status: err.status });
    }
    console.error("[ai/video-status]", err);
    return NextResponse.json(
      { status: "FAILED", error: "Could not check the generation status." },
      { status: 500 },
    );
  }
}
