import "server-only";
import crypto from "crypto";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

const SESSION_COOKIE = "visioncut_session";
const SESSION_SECRET =
  process.env.AUTH_SECRET || "visioncut-dev-secret-do-not-use-in-production";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/* ---------------- Password hashing (scrypt) ---------------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* ---------------- Signed session tokens (HMAC-SHA256) ---------------- */

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function signToken(payload: Record<string, unknown>): string {
  const body = base64url(
    Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }))
  );
  const sig = base64url(crypto.createHmac("sha256", SESSION_SECRET).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token: string): { userId: string; exp: number } | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest();
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.userId || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return { userId: payload.userId, exp: payload.exp };
  } catch {
    return null;
  }
}

/* ---------------- Session helpers ---------------- */

export async function setSessionCookie(userId: string) {
  const token = signToken({ userId });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarColor: string;
  isDemo: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const parsed = verifyToken(token);
    if (!parsed) return null;
    const user = await db.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, email: true, name: true, avatarColor: true, isDemo: true },
    });
    return user ?? null;
  } catch {
    return null;
  }
}

export function generateResetToken(): string {
  return crypto.randomBytes(24).toString("hex");
}
