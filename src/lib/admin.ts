/**
 * Admin gate — the admin panel and /api/admin/* endpoints require the admin
 * key. ADMIN_KEY takes precedence; it falls back to MCP_TOKEN so the panel
 * works with the secret that is already provisioned on the deployment.
 * Accepted transports: X-Admin-Key header, Authorization: Bearer, or ?key=.
 */
import type { NextRequest } from "next/server";

export function checkAdminAuth(req: NextRequest): boolean {
  const token = (process.env.ADMIN_KEY?.trim() || process.env.MCP_TOKEN?.trim() || "").trim();
  if (!token) return false; // not configured -> panel disabled
  const header =
    req.headers.get("x-admin-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (header && header.trim() === token) return true;
  return new URL(req.url).searchParams.get("key") === token;
}
