/**
 * DELETE /api/admin/projects/[id]  (X-Admin-Key header or ?key=)
 *
 * Admin removal of any project. Clips live inside project.data, so the row
 * delete is sufficient; the schema has no other project relations.
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
    const gone = await db.project.delete({ where: { id }, select: { id: true, name: true } });
    return NextResponse.json({ deleted: gone });
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
}
