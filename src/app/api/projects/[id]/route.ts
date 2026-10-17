import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function getOwnedProject(id: string, userId: string) {
  return db.project.findFirst({ where: { id, userId } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "21:9"]).optional(),
  data: z.string().max(4_000_000).optional(), // serialized editor state, ~4MB cap
  thumbnail: z.string().max(600_000).optional(), // small data-URL jpeg
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const existing = await getOwnedProject(id, user.id);
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const project = await db.project.update({
      where: { id },
      data: { ...parsed.data, updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, updatedAt: project.updatedAt });
  } catch (err) {
    console.error("[projects/patch]", err);
    return NextResponse.json({ error: "Could not save project." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const existing = await getOwnedProject(id, user.id);
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
