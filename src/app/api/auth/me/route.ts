import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const user = await db.user.update({
      where: { id: session.id },
      data: parsed.data,
      select: { id: true, email: true, name: true, avatarColor: true, isDemo: true },
    });
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[auth/me/patch]", err);
    return NextResponse.json({ error: "Could not update profile." }, { status: 500 });
  }
}
