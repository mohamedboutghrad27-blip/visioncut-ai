import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * Cloud backup for editor media blobs (chunked).
 *
 * The editor stores media blobs in the browser's IndexedDB so projects open
 * instantly and work offline — but blobs are per-browser, so opening the same
 * project from another device/browser lost every clip's media ("missing media"
 * banner, black preview). These endpoints back each asset up to Postgres
 * (Neon) in ~3MB chunks, and serve them back so any browser can restore.
 */

export const MAX_CLOUD_FILE = 200 * 1024 * 1024; // matches client MAX_FILE_SIZE
export const MAX_USER_CLOUD_TOTAL = 1024 * 1024 * 1024; // 1GB per user

const initSchema = z.object({
  id: z.string().regex(/^as_[a-z0-9]+$/, "Invalid asset id"),
  name: z.string().trim().min(1).max(80),
  mimeType: z.string().trim().max(120),
  size: z.number().int().positive().max(MAX_CLOUD_FILE),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = initSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const { id, name, mimeType, size } = parsed.data;

    const agg = await db.mediaFile.aggregate({ where: { userId: user.id }, _sum: { size: true } });
    const total = agg._sum.size ?? 0;
    if (total + size > MAX_USER_CLOUD_TOTAL) {
      return NextResponse.json(
        { error: "Cloud media storage is full (1GB per account). Remove old projects or contact support." },
        { status: 507 },
      );
    }

    // Upsert: re-uploading an asset replaces its chunks entirely.
    const existing = await db.mediaFile.findUnique({ where: { id } });
    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ error: "This asset belongs to another account" }, { status: 403 });
    }
    if (existing) await db.mediaChunk.deleteMany({ where: { fileId: id } });

    await db.mediaFile.upsert({
      where: { id },
      create: { id, userId: user.id, name, mimeType, size },
      update: { userId: user.id, name, mimeType, size },
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[media/init]", err);
    return NextResponse.json({ error: "Could not start the media upload." }, { status: 500 });
  }
}
