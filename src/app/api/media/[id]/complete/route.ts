import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** Finalize a chunked upload: verify every chunk arrived. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^as_[a-z0-9]+$/.test(id)) return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });

  try {
    const file = await db.mediaFile.findUnique({
      where: { id },
      select: { userId: true, size: true },
    });
    if (!file) return NextResponse.json({ error: "Unknown media id" }, { status: 404 });
    if (file.userId !== user.id) return NextResponse.json({ error: "This asset belongs to another account" }, { status: 403 });

    const agg = await db.mediaChunk.aggregate({ where: { fileId: id }, _count: { _all: true } });
    const chunkCount = agg._count._all;
    const expectedChunks = Math.ceil(file.size / (3 * 1024 * 1024));
    if (chunkCount !== expectedChunks) {
      return NextResponse.json(
        { error: `Incomplete upload: ${chunkCount}/${expectedChunks} chunks.`, chunkCount, expectedChunks },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, id, chunks: chunkCount });
  } catch (err) {
    console.error("[media/complete]", err);
    return NextResponse.json({ error: "Finalize failed." }, { status: 500 });
  }
}
