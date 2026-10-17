import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const reset = await db.passwordReset.findUnique({ where: { token: parsed.data.token } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }
    await db.user.update({
      where: { id: reset.userId },
      data: { passwordHash: hashPassword(parsed.data.password) },
    });
    await db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    await setSessionCookie(reset.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/reset-confirm]", err);
    return NextResponse.json({ error: "Reset failed. Please try again." }, { status: 500 });
  }
}
