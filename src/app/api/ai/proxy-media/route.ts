import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Server-side media proxy: streams a remote video (e.g. AI-generated video from
 * the generation CDN) through our origin so the browser can download it without
 * CORS restrictions. Only http(s) URLs are allowed and the response size is capped.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "A valid http(s) url is required" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > 300_000_000) {
      return NextResponse.json({ error: "Remote file exceeds the 300MB proxy limit." }, { status: 413 });
    }
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[ai/proxy-media]", err);
    return NextResponse.json({ error: "Could not fetch the remote media." }, { status: 502 });
  }
}
