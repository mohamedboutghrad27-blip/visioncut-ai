import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, aspectRatio: true, thumbnail: true, isDemo: true,
      createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json({ projects });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "21:9"]).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const project = await db.project.create({
      data: {
        userId: user.id,
        name: parsed.data.name || "Untitled Project",
        aspectRatio: parsed.data.aspectRatio || "16:9",
        data: JSON.stringify({
          version: 1,
          tracks: [
            { id: "v1", type: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
            { id: "a1", type: "audio", name: "Audio 1", muted: false, hidden: false, locked: false, height: 56 },
          ],
          clips: [],
          duration: 0,
        }),
      },
    });
    return NextResponse.json({ project: { id: project.id, name: project.name } });
  } catch (err) {
    console.error("[projects/create]", err);
    return NextResponse.json({ error: "Could not create project." }, { status: 500 });
  }
}
