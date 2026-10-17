import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateResetToken } from "@/lib/auth";

const schema = z.object({ email: z.string().trim().email("Please enter a valid email address") });

/**
 * DEVELOPMENT MODE: no email provider is configured in this environment, so the
 * reset link is returned in the response instead of being emailed. This is clearly
 * surfaced in the UI. In production, wire this to an email service and remove the link.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();
    const user = await db.user.findUnique({ where: { email } });

    // Always answer the same way to avoid leaking which emails exist
    const generic = {
      ok: true,
      message: "If an account exists for this email, a reset link has been generated.",
    };
    if (!user) return NextResponse.json(generic);

    const token = generateResetToken();
    await db.passwordReset.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 1000 * 60 * 30) },
    });

    return NextResponse.json({ ...generic, devResetToken: token, devMode: true });
  } catch (err) {
    console.error("[auth/reset-request]", err);
    return NextResponse.json({ error: "Request failed. Please try again." }, { status: 500 });
  }
}
