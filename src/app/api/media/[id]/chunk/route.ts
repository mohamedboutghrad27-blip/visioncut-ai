import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** Upload one ~3MB chunk of a media file (raw binary body). */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^as_[a-z0-9]+$/.test(id)) return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });

  try {
    const file = await db.mediaFile.findUnique({ where: { id }, select: { userId: true } });
    if (!file) return NextResponse.json({ error: "Unknown media id — call init first" }, { status: 404 });
    if (file.userId !== user.id) return NextResponse.json({ error: "This asset belongs to another account" }, { status: 403 });

    const idxRaw = req.nextUrl.searchParams.get("index");
    const idx = Number(idxRaw);
    if (!Number.isInteger(idx) || idx < 0 || idx > 4096) {
      return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
    }

    const buf = await req.arrayBuffer();
    if (buf.byteLength === 0) return NextResponse.json({ error: "Empty chunk" }, { status: 400 });
    if (buf.byteLength > 4 * 1024 * 1024) return NextResponse.json({ error: "Chunk too large" }, { status: 413 });

    const data = new Uint8Array(buf);
    await db.mediaChunk.upsert({
      where: { fileId_idx: { fileId: id, idx } },
      create: { fileId: id, idx, data },
      update: { data },
    });
    return NextResponse.json({ ok: true, idx, bytes: buf.byteLength });
  } catch (err) {
    console.error("[media/chunk]", err);
    return NextResponse.json({ error: "Chunk upload failed." }, { status: 500 });
  }
}
