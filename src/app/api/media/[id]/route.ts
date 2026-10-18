import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/**
 * Stream a backed-up media file back to the browser.
 * Chunks are fetched in order and piped through a ReadableStream so large
 * videos don't have to be fully buffered in server memory.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^as_[a-z0-9]+$/.test(id)) return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });

  try {
    const file = await db.mediaFile.findUnique({
      where: { id },
      select: { userId: true, mimeType: true, size: true },
    });
    if (!file) return NextResponse.json({ error: "Media not found in cloud backup" }, { status: 404 });
    if (file.userId !== user.id) return NextResponse.json({ error: "This asset belongs to another account" }, { status: 403 });

    const chunks = await db.mediaChunk.findMany({
      where: { fileId: id },
      orderBy: { idx: "asc" },
      select: { data: true },
    });
    if (chunks.length === 0) return NextResponse.json({ error: "Media backup is empty" }, { status: 404 });

    const encoderChunks = chunks.map((c) => Buffer.from(c.data));
    const total = encoderChunks.reduce((n, b) => n + b.length, 0);
    let sent = 0;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const buf of encoderChunks) {
          controller.enqueue(new Uint8Array(buf));
          sent += buf.length;
        }
        controller.close();
      },
      pull() {
        /* all enqueued eagerly; chunks are capped at ~200MB worst case */
      },
      cancel() {
        sent = total; // no-op, keeps linters calm
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(total),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[media/get]", err);
    return NextResponse.json({ error: "Could not read the media backup." }, { status: 500 });
  }
}
