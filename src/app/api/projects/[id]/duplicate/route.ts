import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const source = await db.project.findFirst({ where: { id, userId: user.id } });
  if (!source) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const copy = await db.project.create({
    data: {
      userId: user.id,
      name: `${source.name} (copy)`.slice(0, 120),
      aspectRatio: source.aspectRatio,
      data: source.data,
      thumbnail: source.thumbnail,
      isDemo: false,
    },
  });
  return NextResponse.json({ project: { id: copy.id, name: copy.name } });
}
