import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    await setSessionCookie(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor, isDemo: user.isDemo },
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}
