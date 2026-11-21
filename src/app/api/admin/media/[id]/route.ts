/**
 * DELETE /api/admin/media/[id]  (X-Admin-Key header or ?key=)
 *
 * Admin removal of a cloud media backup; MediaChunk rows cascade.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const gone = await db.mediaFile.delete({ where: { id }, select: { id: true, name: true } });
    return NextResponse.json({ deleted: gone });
  } catch {
    return NextResponse.json({ error: "Media file not found" }, { status: 404 });
  }
}
