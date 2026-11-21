/**
 * DELETE /api/admin/users/[id]  (X-Admin-Key header or ?key=)
 *
 * Admin removal of a user account. The Prisma schema cascades
 * projects, password resets and media backups (and their chunks),
 * so a single delete fully cleans the account.
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
    const gone = await db.user.delete({ where: { id }, select: { id: true, email: true } });
    return NextResponse.json({ deleted: gone });
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}
