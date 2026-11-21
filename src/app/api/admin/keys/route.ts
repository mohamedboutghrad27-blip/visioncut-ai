/**
 * GET /api/admin/keys  (X-Admin-Key header or ?key=)
 *
 * Lets the authenticated admin reveal the MCP API token for connector setup.
 * Gated by the same admin key as every other /api/admin/* endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    mcpToken: process.env.MCP_TOKEN?.trim() || "",
    mcpUrl: "https://visioncut-ai-mu.vercel.app/api/mcp",
  });
}
