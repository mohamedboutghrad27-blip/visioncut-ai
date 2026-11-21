/**
 * Admin gate — the admin panel and /api/admin/* endpoints accept either the
 * dedicated ADMIN_KEY or the MCP token (so the panel keeps working with the
 * secret that is already provisioned on the deployment).
 * Accepted transports: X-Admin-Key header, Authorization: Bearer, or ?key=.
 */
import type { NextRequest } from "next/server";

export function acceptedAdminKeys(): string[] {
  return [process.env.ADMIN_KEY?.trim(), process.env.MCP_TOKEN?.trim()].filter(
    (k): k is string => Boolean(k),
  );
}

export function checkAdminAuth(req: NextRequest): boolean {
  const keys = acceptedAdminKeys();
  if (keys.length === 0) return false; // not configured -> panel disabled
  const header =
    req.headers.get("x-admin-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const presented = (header?.trim() || new URL(req.url).searchParams.get("key") || "").trim();
  return keys.includes(presented);
}
