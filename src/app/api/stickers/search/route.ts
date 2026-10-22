import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { searchStickersWithTenor, STICKER_GROUPS } from "@/lib/stickers";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").slice(0, 80);
  const group = searchParams.get("group") || undefined;
  const limit = Number(searchParams.get("limit") || 48);
  try {
    const stickers = await searchStickersWithTenor(q, { group, limit: Number.isFinite(limit) ? limit : 48 });
    return NextResponse.json({ stickers, groups: STICKER_GROUPS, source: stickers[0]?.source || "openmoji" });
  } catch (err) {
    console.error("[stickers/search]", err);
    return NextResponse.json({ error: "Sticker search failed. Please try again." }, { status: 500 });
  }
}
