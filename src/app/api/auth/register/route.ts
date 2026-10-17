import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  email: z.string().trim().email("Please enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const email = parsed.data.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 }
      );
    }
    const colors = ["#8b5cf6", "#3b82f6", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e"];
    const user = await db.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash: hashPassword(parsed.data.password),
        avatarColor: colors[Math.floor(Math.random() * colors.length)],
      },
    });
    await setSessionCookie(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor, isDemo: false },
    });
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
}
